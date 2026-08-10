"""Weekday-hour pedestrian count lookup, backed by sensor_hourly_profile."""

from dataclasses import dataclass

from app.db import get_cursor


@dataclass(frozen=True)
class CountProfile:
    """Average pedestrian counts for one weekday-hour, keyed by sensor id.

    `frozen=True` prevents rebinding `counts`, but the dict itself is still
    mutable — treat it as read-only. Nothing in this codebase mutates it.
    """

    counts: dict[int, int]

    def count_for(self, sensor_id: int):
        """Average count, or None when the sensor reported no data."""
        return self.counts.get(sensor_id)

    def has_data(self, sensor_id: int) -> bool:
        return sensor_id in self.counts


def load_profile(dow: int, hour: int) -> CountProfile:
    """Load every sensor's average count for the given weekday and hour."""
    with get_cursor() as cur:
        cur.execute(
            "SELECT location_id, avg_count FROM sensor_hourly_profile "
            "WHERE dow = %s AND hourday = %s",
            (dow, hour),
        )
        return CountProfile({r["location_id"]: r["avg_count"] for r in cur.fetchall()})
