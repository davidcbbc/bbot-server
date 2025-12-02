"""
A lightweight FastAPI backend that proxies BBOT Server data into dashboard-friendly responses.

Run with:
    uvicorn dashboard_backend.main:app --reload

Environment variables:
    DASHBOARD_BBOT_API_URL: Base URL of the BBOT Server API (default: http://localhost:8807/v1)
    DASHBOARD_BBOT_API_KEY: API key for authenticating to BBOT Server
    DASHBOARD_DEFAULT_LIMIT: Default number of records fetched for list endpoints
"""

from __future__ import annotations

import asyncio
import json
import os
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

import httpx
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


@dataclass
class Settings:
    """Configuration sourced from environment variables."""

    bbot_api_url: str = os.getenv("DASHBOARD_BBOT_API_URL", "http://localhost:8807/v1")
    bbot_api_key: str = os.getenv("DASHBOARD_BBOT_API_KEY", "")
    default_limit: int = int(os.getenv("DASHBOARD_DEFAULT_LIMIT", "25"))


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


class AssetRecord(BaseModel):
    id: str | None = None
    name: str | None = None
    host: str | None = None
    category: str | None = None
    tags: list[str] = Field(default_factory=list)
    raw: dict[str, Any] = Field(default_factory=dict)

    @classmethod
    def from_payload(cls, payload: Any) -> "AssetRecord":
        tags = payload.get("tags") if isinstance(payload, dict) else []
        if not isinstance(tags, list):
            tags = [str(tags)]
        return cls(
            id=(payload or {}).get("_id") if isinstance(payload, dict) else None,
            name=(payload or {}).get("name") if isinstance(payload, dict) else None,
            host=(payload or {}).get("host") or (payload or {}).get("hostname") if isinstance(payload, dict) else None,
            category=(payload or {}).get("category") if isinstance(payload, dict) else None,
            tags=[str(tag) for tag in tags],
            raw=payload if isinstance(payload, dict) else {},
        )


class EventRecord(BaseModel):
    id: str | None = None
    type: str | None = None
    message: str | None = None
    severity: str | None = None
    created: str | None = None
    raw: dict[str, Any] = Field(default_factory=dict)

    @classmethod
    def from_payload(cls, payload: Any) -> "EventRecord":
        return cls(
            id=(payload or {}).get("_id") if isinstance(payload, dict) else None,
            type=(payload or {}).get("type") if isinstance(payload, dict) else None,
            message=(payload or {}).get("message") or (payload or {}).get("title") if isinstance(payload, dict) else None,
            severity=(payload or {}).get("severity") if isinstance(payload, dict) else None,
            created=(payload or {}).get("created") if isinstance(payload, dict) else None,
            raw=payload if isinstance(payload, dict) else {},
        )


class OverviewResponse(BaseModel):
    asset_count: int
    recent_events: list[EventRecord]
    highlighted_assets: list[AssetRecord]


class PassthroughResponse(BaseModel):
    records: list[dict[str, Any]]
    source: str


app = FastAPI(title="BBOT Dashboard Backend", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def fetch_remote(path: str, settings: Settings) -> Any:
    base_url = settings.bbot_api_url.rstrip("/")
    url = f"{base_url}{path}"
    headers = {"X-API-Key": settings.bbot_api_key} if settings.bbot_api_key else {}
    async with httpx.AsyncClient(follow_redirects=True, timeout=15) as client:
        response = await client.get(url, headers=headers)
    if response.status_code == 401:
        raise HTTPException(status_code=401, detail="BBOT API rejected the provided API key")
    try:
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:  # pragma: no cover - passthrough for caller
        raise HTTPException(status_code=exc.response.status_code, detail=str(exc))

    try:
        return response.json()
    except json.JSONDecodeError:
        # Some BBOT endpoints (e.g., logs/events) can return newline-delimited JSON.
        lines = [line.strip() for line in response.text.splitlines() if line.strip()]
        parsed_lines: list[Any] = []
        for line in lines:
            try:
                parsed_lines.append(json.loads(line))
            except json.JSONDecodeError as exc:  # pragma: no cover - defensive fallback
                raise HTTPException(status_code=502, detail=f"Invalid JSON from BBOT API: {exc}")
        if parsed_lines:
            return parsed_lines
        raise HTTPException(status_code=502, detail="Empty response from BBOT API")


def _extract_records(payload: Any) -> list[Any]:
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ("results", "data", "items", "records"):
            if key in payload and isinstance(payload[key], list):
                return payload[key]
        return [payload]
    return []


@app.get("/health")
async def healthcheck(settings: Settings = Depends(get_settings)) -> dict[str, str]:
    return {"status": "ok", "bbot_api_url": settings.bbot_api_url}


@app.get("/overview", response_model=OverviewResponse)
async def overview(settings: Settings = Depends(get_settings)) -> OverviewResponse:
    hosts_task = asyncio.create_task(fetch_remote("/assets/hosts", settings))
    events_task = asyncio.create_task(fetch_remote("/events/list", settings))

    hosts_payload, events_payload = await asyncio.gather(hosts_task, events_task)

    host_records = [AssetRecord.from_payload(record) for record in _extract_records(hosts_payload)]
    event_records = [EventRecord.from_payload(record) for record in _extract_records(events_payload)]

    highlighted_assets = host_records[:5]
    recent_events = event_records[:10]

    return OverviewResponse(
        asset_count=len(host_records),
        recent_events=recent_events,
        highlighted_assets=highlighted_assets,
    )


@app.get("/assets", response_model=PassthroughResponse)
async def assets(
    limit: int = Query(default=None, ge=1, le=500), settings: Settings = Depends(get_settings)
) -> PassthroughResponse:
    page_size = limit or settings.default_limit
    query_param = f"?limit={page_size}" if page_size else ""
    payload = await fetch_remote(f"/assets/hosts{query_param}", settings)
    return PassthroughResponse(records=_extract_records(payload), source="/assets/hosts")


@app.get("/events", response_model=PassthroughResponse)
async def events(
    limit: int = Query(default=None, ge=1, le=500), settings: Settings = Depends(get_settings)
) -> PassthroughResponse:
    page_size = limit or settings.default_limit
    query_param = f"?limit={page_size}" if page_size else ""
    payload = await fetch_remote(f"/events/list{query_param}", settings)
    return PassthroughResponse(records=_extract_records(payload), source="/events/list")


@app.get("/insights", response_model=dict[str, Any])
async def insights(settings: Settings = Depends(get_settings)) -> dict[str, Any]:
    hosts_payload, events_payload = await asyncio.gather(
        fetch_remote("/assets/hosts", settings), fetch_remote("/events/list", settings)
    )
    hosts = _extract_records(hosts_payload)
    events = _extract_records(events_payload)

    severity_buckets: dict[str, int] = {}
    for event in events:
        severity = "unknown"
        if isinstance(event, dict) and event.get("severity"):
            severity = str(event["severity"]).lower()
        severity_buckets[severity] = severity_buckets.get(severity, 0) + 1

    categories: dict[str, int] = {}
    for host in hosts:
        category = "uncategorized"
        if isinstance(host, dict) and host.get("category"):
            category = str(host["category"]).lower()
        categories[category] = categories.get(category, 0) + 1

    return {
        "totals": {"assets": len(hosts), "events": len(events)},
        "severity_breakdown": severity_buckets,
        "asset_categories": categories,
    }
