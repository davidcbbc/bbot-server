import logging
from contextlib import suppress
from typing import Optional

try:  # Optional dependency
    from neo4j import AsyncGraphDatabase
except Exception:  # pragma: no cover - handled by build_forwarder
    AsyncGraphDatabase = None


class Neo4jForwarder:
    """Best-effort mirror for ingested events into Neo4j."""

    def __init__(self, uri: str, username: str, password: str):
        self.log = logging.getLogger(__name__)
        self._driver = AsyncGraphDatabase.driver(uri, auth=(username, password))

    async def close(self):
        with suppress(Exception):
            await self._driver.close()

    async def forward_event(self, event):
        """Write a BBOT event node and (optionally) host relationship."""

        if not getattr(event, "uuid", None):
            self.log.debug("Skipping Neo4j forward for event without UUID: %s", event)
            return

        host = getattr(event, "host", None)
        payload = event.model_dump()

        cypher = (
            "MERGE (e:BBOTEvent {uuid: $uuid}) "
            "SET e += $props "
            "WITH e, $host AS host "
            "CALL { WITH e, host WHERE host IS NOT NULL "
            "MERGE (h:Host {name: host}) MERGE (h)-[:HAS_EVENT]->(e) RETURN 1 } "
            "RETURN e"
        )

        await self._driver.execute_query(cypher, uuid=event.uuid, props=payload, host=host)


def build_forwarder(config: Optional[dict]):
    if not config:
        return None

    enabled = config.get("forward_ingested_events", False)
    if not enabled:
        return None

    uri = config.get("uri")
    username = config.get("username")
    password = config.get("password")

    if not (uri and username and password):
        raise ValueError("Neo4j forwarder requires uri, username, and password")

    if AsyncGraphDatabase is None:
        raise ImportError("neo4j driver is not installed; run `poetry add neo4j` or install the neo4j package")

    return Neo4jForwarder(uri=uri, username=username, password=password)
