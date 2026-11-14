"""HTTP API for simulated crew health readings."""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime
from uuid import UUID

import psycopg
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from app.guidance import DISCLAIMER, IndicatorError
from app.repository import (
    ConflictError,
    NotFoundError,
    create_crew,
    create_reading,
    dashboard,
    ensure_ready,
    get_crew,
    import_vitals_csv,
    list_readings,
    set_share_mode,
)

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger(__name__)


def _origins() -> list[str]:
    raw = os.environ.get(
        "FRONTEND_ORIGINS",
        "http://127.0.0.1:5173,http://localhost:5173",
    )
    return [item.strip() for item in raw.split(",") if item.strip()]


@asynccontextmanager
async def _lifespan(_app: FastAPI):
    ensure_ready()
    yield


app = FastAPI(
    title="Astronaut Health Monitor",
    version="0.1.0",
    summary="Simulated crew health readings for the NASA Space Apps Challenge 2026.",
    lifespan=_lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins(),
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Accept"],
    allow_credentials=False,
)


@app.middleware("http")
async def _log_and_guard(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "no-store"
    logger.info("%s %s %s", request.method, request.url.path, response.status_code)
    return response


class CrewCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    call_sign: str = Field(min_length=2, max_length=16, pattern=r"^[A-Za-z0-9-]+$")
    full_name: str = Field(min_length=1, max_length=120)
    role: str = Field(min_length=1, max_length=80)
    mission: str = Field(min_length=1, max_length=120)


class ShareUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    share_mode: str = Field(pattern=r"^(full|alerts_only)$")


class ReadingCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    crew_member_id: UUID
    indicator: str = Field(min_length=1, max_length=64)
    value: float
    recorded_at: datetime | None = None


@app.get("/")
def root() -> dict[str, str]:
    return {
        "service": "astronaut-health-monitor",
        "data_source": "simulated",
        "health": "/health",
        "dashboard": "/api/dashboard",
        "docs": "/docs",
        "disclaimer": DISCLAIMER,
    }


@app.exception_handler(psycopg.Error)
async def _database_error(_request, exc: psycopg.Error):
    logger.warning("Database error: %s", type(exc).__name__)
    return JSONResponse(status_code=503, content={"detail": "Database is unavailable"})


@app.get("/health")
def health() -> dict[str, str]:
    from app import db

    try:
        with db.connect() as conn:
            conn.execute("SELECT 1")
    except psycopg.Error as exc:
        logger.warning("Health check failed: %s", type(exc).__name__)
        raise HTTPException(status_code=503, detail="Database is unavailable") from exc
    return {"status": "ok", "database": "ok", "data_source": "simulated"}


@app.get("/api/dashboard")
def get_dashboard(viewer: str | None = None) -> dict:
    return dashboard(viewer)


@app.get("/api/demo")
def get_demo(viewer: str | None = None) -> dict:
    return dashboard(viewer)["demo"]


@app.get("/api/insights")
def get_insights(viewer: str | None = None) -> dict:
    payload = dashboard(viewer)
    return {"disclaimer": payload["disclaimer"], "insights": payload["insights"], "recommendations": payload["recommendations"]}


@app.get("/api/crew")
def get_crew_collection() -> dict:
    payload = dashboard()
    return {
        "data_source": payload["data_source"],
        "crew": [list_crew_summary(member) for member in payload["crew"]],
    }


@app.post("/api/crew", status_code=201)
def post_crew(payload: CrewCreate) -> dict:
    try:
        member = create_crew(
            call_sign=payload.call_sign,
            full_name=payload.full_name,
            role=payload.role,
            mission=payload.mission,
        )
    except ConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return member


@app.post("/api/crew/{crew_id}/sharing")
def post_sharing(crew_id: UUID, payload: ShareUpdate) -> dict:
    try:
        return set_share_mode(crew_id, payload.share_mode)
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/api/uploads")
async def post_upload(file: UploadFile = File(...)) -> dict:
    raw = await file.read()
    if len(raw) > 2_000_000:
        raise HTTPException(status_code=413, detail="CSV uploads are limited to 2 MB")
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeError as exc:
        raise HTTPException(status_code=422, detail="Upload must be UTF-8 CSV") from exc
    try:
        return import_vitals_csv(text)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/api/crew/{crew_id}")
def get_crew_member(crew_id: UUID) -> dict:
    try:
        return get_crew(crew_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/readings")
def get_readings(crew_member_id: UUID) -> dict:
    try:
        readings = list_readings(crew_member_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    sources = {item["source"] for item in readings}
    data_source = "simulated" if not sources or sources <= {"simulated"} else "mixed"
    return {
        "data_source": data_source,
        "crew_member_id": crew_member_id,
        "readings": readings,
    }


@app.post("/api/readings", status_code=201)
def post_reading(payload: ReadingCreate) -> dict:
    try:
        return create_reading(
            crew_member_id=payload.crew_member_id,
            indicator=payload.indicator,
            value=payload.value,
            recorded_at_value=payload.recorded_at,
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except IndicatorError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


def list_crew_summary(member: dict) -> dict:
    return {
        "id": member["id"],
        "call_sign": member["call_sign"],
        "full_name": member["full_name"],
        "role": member["role"],
        "mission": member.get("mission"),
        "share_mode": member.get("share_mode"),
        "overall_band": member["overall_band"],
    }
