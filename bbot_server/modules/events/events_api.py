import asyncio
from fastapi import Query
from contextlib import suppress
from bbot.models.pydantic import Event
from typing import AsyncGenerator, Annotated, Optional
from datetime import datetime, timezone, timedelta

from bbot_server.applets.base import BaseApplet, api_endpoint


NEO4J_FORWARD_TAG = "forward-to-neo4j"
NEO4J_SKIP_TAG = "skip-neo4j-forward"


class EventsApplet(BaseApplet):
    name = "Events"
    watched_events = ["*"]
    description = "query raw BBOT scan events"
    attach_to = "root_applet"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._archive_events_task = None

    async def handle_event(self, event: Event, asset):
        # write the event to the database
        await self.event_store.insert_event(event)

        # best-effort forward to Neo4j when configured and allowed
        neo4j_forwarder = getattr(self.root, "neo4j_forwarder", None)
        if neo4j_forwarder is not None and self._should_forward_to_neo4j(event):
            try:
                await neo4j_forwarder.forward_event(event)
            except Exception as e:
                self.log.error(f"Error forwarding event {event.uuid} to Neo4j: {e}")

    @api_endpoint("/", methods=["POST"], summary="Insert a BBOT event into the asset database")
    async def insert_event(
        self,
        event: Event,
        forward_to_neo4j: Annotated[
            Optional[bool],
            Query(
                description=(
                    "Override the server config for this request: forward (true) or skip (false)"
                    " Neo4j mirroring for ingested events."
                )
            ),
        ] = None,
    ):
        """
        Insert a BBOT event into the asset database
        """
        if forward_to_neo4j is not None:
            tags = set(event.tags or [])
            if forward_to_neo4j:
                tags.discard(NEO4J_SKIP_TAG)
                tags.add(NEO4J_FORWARD_TAG)
            else:
                tags.discard(NEO4J_FORWARD_TAG)
                tags.add(NEO4J_SKIP_TAG)
            event.tags = list(tags)

        # publish event to the message queue
        # it will be picked up by the watchdog and ingested
        await self.root.message_queue.publish_event(event)

    @api_endpoint("/get/{uuid}", methods=["GET"], summary="Get an event by its UUID")
    async def get_event(self, uuid: str) -> Event:
        return await self.event_store.get_event(uuid)

    @api_endpoint("/tail", type="websocket_stream_outgoing", response_model=Event)
    async def tail_events(self, n: int = 0):
        async for event in self.message_queue.tail_events(n=n):
            yield event

    @api_endpoint("/{uuid}/archive", methods=["POST"], summary="Archive an event")
    async def archive_event(self, uuid: str):
        await self.event_store.archive_event(uuid)

    @api_endpoint("/archive", methods=["POST"], summary="Archive old events")
    async def archive_old_events(
        self,
        older_than: Annotated[int, Query(description="Archive events older than this many days")],
    ):
        # cancel the current archiving task if one is in progress
        if self._archive_events_task is not None:
            self.log.info(f"Archive is already in progress, cancelling")
            self._archive_events_task.cancel()
            with suppress(BaseException):
                await asyncio.wait_for(self._archive_events_task, 0.5)
            self._archive_events_task = None
        self._archive_events_task = asyncio.create_task(self._archive_events(older_than=older_than))

    @api_endpoint("/list", methods=["GET"], type="http_stream", response_model=Event, summary="Stream all events")
    async def get_events(self, type: str = None, host: str = None, archived: bool = False, active: bool = True):
        async for event in self.event_store.get_events(type=type, host=host, archived=archived, active=active):
            yield event

    @api_endpoint(
        "/ingest", type="websocket_stream_incoming", response_model=Event, summary="Ingest events via websocket"
    )
    async def consume_event_stream(self, event_generator: AsyncGenerator[Event, None]):
        """
        Allows consuming of events via a websocket stream.

        This is used by the agent to send events to the server.
        """
        async for event in event_generator:
            await self.insert_event(event)

    async def _archive_events(self, older_than: int):
        archive_after = (datetime.now(timezone.utc) - timedelta(days=older_than)).timestamp()
        # archive old events
        await self.event_store.archive_events(older_than=archive_after)
        # refresh asset database
        await self.root.assets.refresh_assets()

    def _should_forward_to_neo4j(self, event: Event) -> bool:
        tags = set(event.tags or [])

        if NEO4J_SKIP_TAG in tags:
            return False

        if NEO4J_FORWARD_TAG in tags:
            return True

        return self.root._config.get("agent", {}).get("neo4j_output", {}).get("forward_ingested_events", False)
