"""HTTP API for crew health readings (real NASA data plus a simulated POC layer)."""

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

from app import db, eda_queries, help as help_loop, predict_queries, replay
from app.guidance import DISCLAIMER, IndicatorError
from app.xemu import history
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
    save_image,
    upload_dir,
    save_note,
    set_indicator_share,
    set_share_mode,
)
from app.xemu import record_sample

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
    # Pending migrations and the simulated crew are prepared on startup on every
    # host. On Vercel the CSV load stays off (LOAD_ON_STARTUP=false), so a cold
    # start applies only the schema changes and idempotent seed.
    try:
        ensure_ready()
    except Exception:  # noqa: BLE001 - the API should answer 503, not fail boot
        logger.exception("Startup database preparation failed; serving with a degraded database")
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


class HelpRequestCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    requester: str = Field(min_length=1, max_length=16)
    module: str = Field(min_length=1, max_length=40)
    reason_code: str = Field(min_length=1, max_length=32)
    reason_text: str | None = Field(default=None, max_length=300)
    severity: str = Field(default="assist", pattern=r"^(assist|emergency)$")


class HelpAction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    crew: str = Field(min_length=1, max_length=16)
    role: str = Field(default="self", pattern=r"^(self|cmo|flight_surgeon|crewmate|commander)$")


def _help_http_error(exc: Exception):
    if isinstance(exc, help_loop.HelpNotFound):
        return HTTPException(status_code=404, detail=str(exc))
    if isinstance(exc, help_loop.HelpConflict):
        return HTTPException(status_code=409, detail=str(exc))
    return HTTPException(status_code=422, detail=str(exc))


@app.get("/")
def root() -> dict[str, str]:
    return {
        "service": "astronaut-health-monitor",
        "data_source": "mixed",
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
    return {"status": "ok", "database": "ok", "data_source": "mixed"}


@app.get("/api/dashboard")
def get_dashboard(viewer: str | None = None, role: str = "self") -> dict:
    return dashboard(viewer, role)


@app.get("/api/demo")
def get_demo(viewer: str | None = None, role: str = "flight_surgeon") -> dict:
    return dashboard(viewer, role)["demo"]


def _eda(query):
    from app import db

    try:
        with db.connect() as conn:
            return query(conn)
    except psycopg.Error as exc:
        logger.warning("EDA query failed: %s", type(exc).__name__)
        raise HTTPException(status_code=503, detail="Database is unavailable") from exc


@app.get("/eda/overview")
def eda_overview() -> dict:
    return _eda(eda_queries.overview)


@app.get("/eda/labs/out_of_range")
def eda_out_of_range(limit: int = 12) -> dict:
    return _eda(lambda conn: eda_queries.out_of_range(conn, limit))


@app.get("/eda/labs/analytes")
def eda_analytes() -> dict:
    return _eda(eda_queries.analytes)


@app.get("/eda/labs/trends")
def eda_trends(analyte: str) -> dict:
    return _eda(lambda conn: eda_queries.trends(conn, analyte))


@app.get("/eda/labs/shift")
def eda_shift(limit: int = 12) -> dict:
    return _eda(lambda conn: eda_queries.shift(conn, limit))


@app.get("/eda/labs/sunburst")
def eda_sunburst() -> dict:
    return _eda(eda_queries.sunburst)


@app.get("/eda/labs/flow")
def eda_flow() -> dict:
    return _eda(eda_queries.flow)


@app.get("/eda/radiation/series")
def eda_radiation() -> dict:
    return _eda(eda_queries.radiation_series)


@app.get("/eda/extremes")
def eda_extremes(limit: int = 15) -> dict:
    return _eda(lambda conn: eda_queries.extremes(conn, limit))


@app.get("/predict/labs")
def predict_labs(crew: str | None = None, analyte: str | None = None) -> dict:
    return _eda(lambda conn: predict_queries.predict_labs(conn, crew, analyte))


@app.get("/predict/labs/risks")
def predict_lab_risks(limit: int = 20) -> dict:
    return _eda(lambda conn: predict_queries.lab_risks(conn, limit))


@app.get("/predict/radiation")
def predict_radiation() -> dict:
    return _eda(predict_queries.predict_radiation)


@app.get("/predict/vitals")
def predict_vitals(crew: str | None = None) -> dict:
    return _eda(lambda conn: predict_queries.predict_vitals(conn, crew))


@app.get("/recommendations")
def predict_recommendations(
    crew: str | None = None,
    role: str = "flight_surgeon",
    viewer: str | None = None,
) -> dict:
    return _eda(lambda conn: predict_queries.recommendations(conn, crew, role, viewer))


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


class NoteCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    crew_id: UUID
    kind: str
    body_region: str | None = None
    note: str = Field(min_length=1, max_length=2000)


class ShareIndicator(BaseModel):
    model_config = ConfigDict(extra="forbid")

    indicator: str = Field(min_length=1, max_length=80)
    shared: bool


@app.post("/api/notes", status_code=201)
def post_note(payload: NoteCreate) -> dict:
    try:
        return save_note(
            crew_id=payload.crew_id,
            kind=payload.kind,
            body_region=payload.body_region,
            note=payload.note,
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/api/crew/{crew_id}/shares")
def post_share(crew_id: UUID, payload: ShareIndicator) -> dict:
    try:
        return set_indicator_share(crew_id, payload.indicator, payload.shared)
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/images", status_code=201)
async def post_image(
    crew_id: UUID,
    body_region: str,
    note: str = "",
    file: UploadFile = File(...),
) -> dict:
    raw = await file.read()
    if len(raw) > 5_000_000:
        raise HTTPException(status_code=413, detail="Images are limited to 5 MB")
    if not raw:
        raise HTTPException(status_code=422, detail="Empty file")
    folder = upload_dir()
    folder.mkdir(parents=True, exist_ok=True)
    safe = (file.filename or "ultrasound").replace("/", "").replace("..", "")[:80]
    stored = f"{crew_id}-{body_region}-{safe}"
    (folder / stored).write_bytes(raw)
    try:
        return save_image(crew_id=crew_id, body_region=body_region, stored_name=stored, note=note)
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/suit-sensors")
def post_suit_sensors(crew: str = "C001") -> dict:
    """One simulated xEMU sample, stored as simulated health readings."""
    try:
        with db.connect() as conn:
            body = record_sample(conn, crew)
            conn.commit()
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return body


@app.get("/api/suit-sensors/history")
def get_suit_sensor_history(crew: str = "C001", limit: int = 20) -> dict:
    """Last stored xEMU samples for one crew member."""
    try:
        with db.connect() as conn:
            return history(conn, crew, limit)
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


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


@app.post("/api/help-requests", status_code=201)
def post_help_request(payload: HelpRequestCreate) -> dict:
    """Ask another crew member for help. One open request per crew member."""
    try:
        with db.connect() as conn:
            created = help_loop.create_request(
                conn,
                requester=payload.requester,
                module=payload.module,
                reason_code=payload.reason_code,
                reason_text=payload.reason_text,
                severity=payload.severity,
            )
            conn.commit()
    except help_loop.HelpError as exc:
        raise _help_http_error(exc) from exc
    return created


@app.get("/api/help-requests")
def get_help_requests(viewer: str | None = None, role: str = "self") -> dict:
    """Open requests plus the viewer's own request (requester can see the detail)."""
    try:
        with db.connect() as conn:
            return help_loop.list_requests(conn, viewer=viewer, role=role)
    except help_loop.HelpError as exc:
        raise _help_http_error(exc) from exc


@app.get("/api/help-requests/{request_id}")
def get_help_request(request_id: str, viewer: str | None = None, role: str = "self") -> dict:
    try:
        with db.connect() as conn:
            return help_loop.get_request(conn, request_id=request_id, viewer=viewer, role=role)
    except help_loop.HelpError as exc:
        raise _help_http_error(exc) from exc


@app.post("/api/help-requests/{request_id}/accept")
def post_help_accept(request_id: str, payload: HelpAction) -> dict:
    """Claim the request. The requester then sees who is on the way."""
    try:
        with db.connect() as conn:
            accepted = help_loop.accept_request(conn, request_id=request_id, crew=payload.crew)
            conn.commit()
    except help_loop.HelpError as exc:
        raise _help_http_error(exc) from exc
    return accepted


@app.post("/api/help-requests/{request_id}/close")
def post_help_close(request_id: str, payload: HelpAction) -> dict:
    try:
        with db.connect() as conn:
            closed = help_loop.close_request(
                conn,
                request_id=request_id,
                crew=payload.crew,
                role=payload.role,
            )
            conn.commit()
    except help_loop.HelpError as exc:
        raise _help_http_error(exc) from exc
    return closed


@app.get("/api/radiation/alert")
def get_radiation_alert(at: str, viewer: str | None = None, role: str = "self") -> dict:
    """Rule answer at one instant of the recorded DosTel replay.

    The UI calls this at each replay frame where the rate crosses the rule
    threshold; the alert is projected by the same role matrix as the board.
    """
    try:
        return replay.radiation_alert(at=at, viewer=viewer, role=role)
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
        "role": member.get("role_title") or member.get("role"),
        "mission": member.get("mission"),
        "share_mode": member.get("share_mode"),
        "overall_band": member["overall_band"],
    }
