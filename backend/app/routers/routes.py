"""Sensory-aware route planning endpoint."""

from datetime import datetime

from fastapi import APIRouter, HTTPException, Query

from app.config import get_settings
from app.db import get_cursor
from app.graph.sensor_graph import load_graph
from app.schemas import CongestionOut, RouteOut, RoutesResponse, SensoryOut, WarningOut
from app.services.planner import plan_routes
from app.services.profile import load_profile

router = APIRouter()


def _landmark(landmark_id: int):
    with get_cursor() as cur:
        cur.execute(
            "SELECT landmark_id, name, latitude, longitude "
            "FROM cbd_landmark WHERE landmark_id = %s",
            (landmark_id,),
        )
        row = cur.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail=f"Unknown landmark: {landmark_id}")
    return row


@router.get("/routes", response_model=RoutesResponse)
def routes(
    origin_id: int = Query(..., description="cbd_landmark id"),
    destination_id: int = Query(..., description="cbd_landmark id"),
    threshold: int | None = Query(default=None, ge=1, description="Counts per hour"),
    dow: int | None = Query(default=None, ge=0, le=6, description="0=Sunday"),
    hour: int | None = Query(default=None, ge=0, le=23),
):
    """Plan a sensory-scored route and its less-congested alternative."""
    settings = get_settings()
    now = datetime.now()
    # PostgreSQL EXTRACT(DOW) is 0=Sunday; Python weekday() is 0=Monday.
    dow = dow if dow is not None else (now.weekday() + 1) % 7
    hour = hour if hour is not None else now.hour
    threshold = threshold or settings.threshold_default

    origin = _landmark(origin_id)
    destination = _landmark(destination_id)

    graph = load_graph()
    profile = load_profile(dow, hour)

    start = graph.snap(origin["latitude"], origin["longitude"])
    goal = graph.snap(destination["latitude"], destination["longitude"])

    result = plan_routes(
        graph, profile, start.node_id, goal.node_id,
        threshold, settings.coverage_min, settings.walk_speed_mps,
    )

    return RoutesResponse(
        routes=[
            RouteOut(
                id=r.route_id,
                type=r.kind,
                path=[[graph.node(n).lat, graph.node(n).lon] for n in r.path],
                distance_m=r.distance_m,
                duration_min=r.duration_min,
                sensory=SensoryOut(
                    level=r.score.level,
                    score=r.score.score,
                    peak_count=r.score.peak_count,
                    coverage=r.score.coverage,
                ),
                congestion=CongestionOut(peak=r.score.peak_count, mean=r.score.mean_count),
            )
            for r in result.routes
        ],
        warnings=[WarningOut(**w) for w in result.warnings],
        threshold_used=threshold,
    )
