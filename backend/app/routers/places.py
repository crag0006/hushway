"""CBD landmark lookup for origin and destination selection."""

from fastapi import APIRouter, Query

from app.db import get_cursor
from app.schemas import PlaceOut, PlacesResponse

router = APIRouter()


@router.get("/places", response_model=PlacesResponse)
def places(q: str = Query(default="", description="Case-insensitive name filter")):
    """List CBD landmarks, optionally filtered by name."""
    with get_cursor() as cur:
        if q:
            cur.execute(
                """
                SELECT landmark_id, name, kind, latitude, longitude
                FROM cbd_landmark
                WHERE name ILIKE %s
                ORDER BY name
                """,
                (f"%{q}%",),
            )
        else:
            cur.execute(
                "SELECT landmark_id, name, kind, latitude, longitude "
                "FROM cbd_landmark ORDER BY name"
            )
        rows = cur.fetchall()

    return PlacesResponse(
        places=[
            PlaceOut(
                id=r["landmark_id"],
                name=r["name"],
                kind=r["kind"],
                lat=r["latitude"],
                lng=r["longitude"],
            )
            for r in rows
        ]
    )
