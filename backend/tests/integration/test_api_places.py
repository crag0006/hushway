from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_places_returns_landmarks():
    body = client.get("/api/places").json()
    assert len(body["places"]) >= 20
    assert {"id", "name", "kind", "lat", "lng"} <= set(body["places"][0])


def test_places_filters_by_query():
    body = client.get("/api/places", params={"q": "flinders"}).json()
    assert any("Flinders" in p["name"] for p in body["places"])


def test_places_query_is_case_insensitive():
    lower = client.get("/api/places", params={"q": "state library"}).json()
    upper = client.get("/api/places", params={"q": "STATE LIBRARY"}).json()
    assert lower["places"] == upper["places"]


def test_unknown_query_returns_empty_list():
    body = client.get("/api/places", params={"q": "zzzznotaplace"}).json()
    assert body["places"] == []


def test_health_reports_loaded_graph():
    body = client.get("/api/health").json()
    assert body["status"] == "ok"
    assert body["graph_nodes"] == 134
    assert body["graph_edges"] > 0
