from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def landmark_id(name):
    body = client.get("/api/places", params={"q": name}).json()
    return body["places"][0]["id"]


def test_returns_routes_between_two_landmarks():
    params = {
        "origin_id": landmark_id("Flinders Street Station"),
        "destination_id": landmark_id("Queen Victoria Market"),
        "dow": 2,
        "hour": 17,
    }
    body = client.get("/api/routes", params=params).json()
    assert len(body["routes"]) >= 1
    route = body["routes"][0]
    assert len(route["path"]) >= 2
    assert all(len(p) == 2 for p in route["path"])
    assert route["sensory"]["level"] in {"low", "high", "unavailable"}
    assert route["distance_m"] > 0
    assert route["duration_min"] >= 1


def test_threshold_param_applied():
    params = {
        "origin_id": landmark_id("Flinders Street Station"),
        "destination_id": landmark_id("Carlton Gardens"),
        "dow": 2,
        "hour": 17,
        "threshold": 250,
    }
    assert client.get("/api/routes", params=params).json()["threshold_used"] == 250


def test_defaults_to_mid_threshold():
    params = {
        "origin_id": landmark_id("Flinders Street Station"),
        "destination_id": landmark_id("Carlton Gardens"),
    }
    assert client.get("/api/routes", params=params).json()["threshold_used"] == 500


def test_unknown_landmark_returns_404():
    params = {"origin_id": 999999, "destination_id": 1}
    assert client.get("/api/routes", params=params).status_code == 404


def test_invalid_hour_returns_422():
    params = {"origin_id": 1, "destination_id": 2, "hour": 99}
    assert client.get("/api/routes", params=params).status_code == 422


def test_peak_hour_is_busier_than_small_hours():
    origin = landmark_id("Flinders Street Station")
    dest = landmark_id("Queen Victoria Market")
    peak = client.get("/api/routes", params={
        "origin_id": origin, "destination_id": dest, "dow": 2, "hour": 17}).json()
    night = client.get("/api/routes", params={
        "origin_id": origin, "destination_id": dest, "dow": 2, "hour": 4}).json()
    assert peak["routes"][0]["congestion"]["peak"] > night["routes"][0]["congestion"]["peak"]
