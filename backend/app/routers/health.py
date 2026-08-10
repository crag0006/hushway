"""Health and readiness endpoint."""

import logging

from fastapi import APIRouter

from app.db import get_cursor

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/health")
def health() -> dict:
    """Report service status and how much data is loaded."""
    counts = {"graph_nodes": 0, "graph_edges": 0, "sensors_with_data": 0}
    status = "ok"
    try:
        with get_cursor() as cur:
            cur.execute("select count(*) as n from graph_node")
            counts["graph_nodes"] = cur.fetchone()["n"]
            cur.execute("select count(*) as n from graph_edge")
            counts["graph_edges"] = cur.fetchone()["n"]
            cur.execute("select count(distinct location_id) as n from sensor_hourly_profile")
            counts["sensors_with_data"] = cur.fetchone()["n"]
    except Exception as exc:  # noqa: BLE001 - health must never raise
        logger.exception("Health check query failed")
        status = f"degraded: {exc.__class__.__name__}"
    return {"status": status, **counts}
