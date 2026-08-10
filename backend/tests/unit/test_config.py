import os

from app.config import PREFERENCE_THRESHOLDS, get_settings


def test_thresholds_match_spec():
    assert PREFERENCE_THRESHOLDS == {"low": 250, "mid": 500, "high": 1000}


def test_default_threshold_is_500():
    assert get_settings().threshold_default == 500


def test_db_password_comes_from_environment(monkeypatch):
    monkeypatch.setenv("HUSHWAY_DB_PASSWORD", "s3cret")
    get_settings.cache_clear()
    assert get_settings().db_password == "s3cret"


def test_cbd_bbox_contains_flinders_street(monkeypatch):
    get_settings.cache_clear()
    min_lat, min_lon, max_lat, max_lon = get_settings().cbd_bbox
    assert min_lat <= -37.8183 <= max_lat
    assert min_lon <= 144.9671 <= max_lon
