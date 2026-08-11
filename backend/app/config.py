"""Environment-driven settings and EPIC-1 constants."""

import os
from dataclasses import dataclass
from functools import lru_cache

# Crowd preference levels from the SearchPanel density pills, in counts per hour.
# Derived from the observed distribution of total_of_directions: p60=247, p75=476, p90=1031.
PREFERENCE_THRESHOLDS = {"low": 250, "mid": 500, "high": 1000}

# Melbourne CBD bounding box: the sensor extent padded slightly.
CBD_BBOX = (-37.832, 144.923, -37.784, 144.992)


@dataclass(frozen=True)
class Settings:
    db_host: str
    db_port: int
    db_name: str
    db_user: str
    db_password: str
    threshold_default: int
    thresholds: dict
    walk_speed_mps: float
    coverage_min: float
    cbd_bbox: tuple


@lru_cache
def get_settings() -> Settings:
    return Settings(
        db_host=os.environ.get("HUSHWAY_DB_HOST", "localhost"),
        db_port=int(os.environ.get("HUSHWAY_DB_PORT", "5432")),
        db_name=os.environ.get("HUSHWAY_DB_NAME", "postgres"),
        db_user=os.environ.get("HUSHWAY_DB_USER", "postgres"),
        db_password=os.environ.get("HUSHWAY_DB_PASSWORD", ""),
        threshold_default=PREFERENCE_THRESHOLDS["mid"],
        thresholds=dict(PREFERENCE_THRESHOLDS),
        walk_speed_mps=1.35,
        coverage_min=0.5,
        cbd_bbox=CBD_BBOX,
    )
