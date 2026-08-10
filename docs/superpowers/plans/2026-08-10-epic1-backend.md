# EPIC-1 Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a FastAPI backend that satisfies all 13 EPIC-1 acceptance criteria and wire the existing React frontend to it, so HushWay plans sensory-scored walking routes across the Melbourne CBD end to end.

**Architecture:** A routable graph is built from the 134 sensor locations (k=4 nearest neighbours, measured fully connected) and served behind a `GraphProvider` interface so real OSM geometry can replace it later. Pedestrian counts are pre-aggregated into a weekday-hour profile table; a Dijkstra planner scores routes against that profile and produces a less-congested alternative where one exists.

**Tech Stack:** Python 3.12, FastAPI, uvicorn, psycopg2, networkx, pydantic v2, pytest. React 18 + TypeScript + Vite on the frontend.

## Global Constraints

- Database is PostgreSQL on `localhost:5432`, database `postgres`, user `postgres`. All connection settings come from `HUSHWAY_DB_*` environment variables. **Never hardcode the password.**
- Static historical data only. No real-time feeds. `pedestrian_counts_fast_hour` is not read by any code in this plan.
- Default sensory threshold is **500** counts/hour. Preference levels are **low=250, mid=500, high=1000**.
- Route coverage below **0.5** means `sensory.level == "unavailable"`.
- Walking speed for duration estimates: **1.35 m/s**.
- CBD bounding box for input validation: latitude `-37.832 .. -37.784`, longitude `144.923 .. 144.992`.
- Backend runs on port **8000**; frontend dev server on **5173**. CORS allows `http://localhost:5173`.
- All new Python is formatted to a 100-character line length.
- Run every Python command from the repository root with the `backend/` directory on the path, i.e. `cd backend && python -m pytest`.

---

## File Structure

**Backend (all new):**

| File | Responsibility |
| --- | --- |
| `backend/requirements.txt` | Pinned runtime + test dependencies |
| `backend/app/config.py` | Environment-driven settings, thresholds, constants |
| `backend/app/db.py` | psycopg2 connection helper |
| `backend/app/schemas.py` | pydantic response models |
| `backend/app/graph/base.py` | `Node`, `Edge`, `GraphProvider` protocol |
| `backend/app/graph/sensor_graph.py` | Loads graph from `graph_node`/`graph_edge`, snapping |
| `backend/app/services/profile.py` | Weekday-hour count lookup |
| `backend/app/services/scoring.py` | Edge counts, levels, coverage, congestion metrics |
| `backend/app/services/planner.py` | Dijkstra, avoidance replan, alternative selection |
| `backend/app/routers/health.py` | `GET /api/health` |
| `backend/app/routers/places.py` | `GET /api/places` |
| `backend/app/routers/routes.py` | `GET /api/routes` |
| `backend/app/main.py` | App assembly, CORS, router registration |

**Database / scripts (new):**

| File | Responsibility |
| --- | --- |
| `db/epic1_graph.sql` | Rebuilds graph tables, creates `cbd_landmark` + `sensor_hourly_profile` |
| `scripts/build_graph.py` | Populates graph and profile from sensors and counts |

**Frontend (fill existing empty files):**

| File | Responsibility |
| --- | --- |
| `frontend/src/api/types.ts` | TypeScript mirrors of backend models |
| `frontend/src/api/client.ts` | Typed fetch wrapper |
| `frontend/src/hooks/useSensitivity.ts` | Crowd preference, persisted |
| `frontend/src/hooks/useRoute.ts` | Route fetching, re-fetch on change |
| `frontend/src/components/SensoryBadge.tsx` | Low / High / Unavailable pill |

**Frontend (modify):** `SearchPanel.tsx`, `RouteCompare.tsx`, `MapView.tsx`, `RouteCard.tsx`, `WarningBanner.tsx`, `data_loader.py`, `README.md`.

---

### Task 1: Backend skeleton, config, health endpoint

**Files:**
- Create: `backend/requirements.txt`, `backend/app/__init__.py`, `backend/app/config.py`, `backend/app/db.py`, `backend/app/routers/__init__.py`, `backend/app/routers/health.py`, `backend/app/main.py`
- Create: `backend/tests/__init__.py`, `backend/tests/conftest.py`, `backend/tests/unit/__init__.py`, `backend/tests/unit/test_config.py`

**Interfaces:**
- Consumes: nothing.
- Produces: `Settings` dataclass with fields `db_host: str`, `db_port: int`, `db_name: str`, `db_user: str`, `db_password: str`, `threshold_default: int`, `thresholds: dict[str, int]`, `walk_speed_mps: float`, `coverage_min: float`, `cbd_bbox: tuple[float, float, float, float]`; `get_settings() -> Settings`; `get_connection()` context manager yielding a psycopg2 connection; FastAPI `app` in `app.main`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/unit/test_config.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/unit/test_config.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.config'`

- [ ] **Step 3: Write the implementation**

Create `backend/requirements.txt`:

```
fastapi==0.115.5
uvicorn[standard]==0.32.1
psycopg2-binary==2.9.10
networkx==3.3
pydantic==2.10.3
pytest==8.3.4
httpx==0.28.1
```

Create empty `backend/app/__init__.py`, `backend/app/routers/__init__.py`, `backend/tests/__init__.py`, `backend/tests/unit/__init__.py`.

Create `backend/app/config.py`:

```python
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
```

Create `backend/app/db.py`:

```python
"""PostgreSQL connection helper."""

from contextlib import contextmanager

import psycopg2
import psycopg2.extras

from app.config import get_settings


@contextmanager
def get_connection():
    """Yield a psycopg2 connection built from environment settings."""
    settings = get_settings()
    conn = psycopg2.connect(
        host=settings.db_host,
        port=settings.db_port,
        dbname=settings.db_name,
        user=settings.db_user,
        password=settings.db_password,
    )
    try:
        yield conn
    finally:
        conn.close()


@contextmanager
def get_cursor():
    """Yield a dict cursor. Read-only helper; callers do not commit."""
    with get_connection() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        try:
            yield cur
        finally:
            cur.close()
```

Create `backend/app/routers/health.py`:

```python
"""Health and readiness endpoint."""

from fastapi import APIRouter

from app.db import get_cursor

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
        status = f"degraded: {exc.__class__.__name__}"
    return {"status": status, **counts}
```

Create `backend/app/main.py`:

```python
"""HushWay EPIC-1 API."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import health

app = FastAPI(title="HushWay API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
```

Create `backend/tests/conftest.py`:

```python
"""Make the `app` package importable from the tests directory."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pip install -r requirements.txt && python -m pytest tests/unit/test_config.py -v`
Expected: 4 passed

- [ ] **Step 5: Verify the app boots**

Run: `cd backend && python -c "from app.main import app; print([r.path for r in app.routes])"`
Expected: output includes `/api/health`

- [ ] **Step 6: Commit**

```bash
git add backend/
git commit -m "feat: backend skeleton with env config and health endpoint"
```

---

### Task 2: Database migration for graph, landmarks and profile

**Files:**
- Create: `db/epic1_graph.sql`

**Interfaces:**
- Consumes: existing `sensor_locations`, `pedestrian_counts_hourly`.
- Produces: tables `graph_node(node_id BIGINT PK, latitude, longitude, node_type, sensor_id INT)`, `graph_edge(edge_id BIGSERIAL PK, from_node_id, to_node_id, length_meters, street_name, is_pedestrian_zone, nearest_sensor_id)`, `cbd_landmark(landmark_id SERIAL PK, name TEXT, kind TEXT, latitude, longitude)`, `sensor_hourly_profile(location_id INT, dow INT, hourday INT, avg_count INT, sample_count INT)`.

- [ ] **Step 1: Write the migration**

Create `db/epic1_graph.sql`:

```sql
-- EPIC-1: routable graph, CBD landmarks, and pre-aggregated hourly profile.
-- Safe to re-run. Replaces the unusable OSM-derived graph.

DROP TABLE IF EXISTS graph_edge CASCADE;
DROP TABLE IF EXISTS graph_node CASCADE;

-- Graph nodes are sensor locations, so every node carries real coordinates.
CREATE TABLE graph_node (
    node_id     BIGINT PRIMARY KEY,
    latitude    FLOAT NOT NULL,
    longitude   FLOAT NOT NULL,
    node_type   VARCHAR(50) NOT NULL DEFAULT 'sensor',
    sensor_id   INT NOT NULL REFERENCES sensor_locations(location_id),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_graph_node_coords ON graph_node(latitude, longitude);

CREATE TABLE graph_edge (
    edge_id            BIGSERIAL PRIMARY KEY,
    from_node_id       BIGINT NOT NULL REFERENCES graph_node(node_id),
    to_node_id         BIGINT NOT NULL REFERENCES graph_node(node_id),
    length_meters      FLOAT NOT NULL,
    street_name        VARCHAR(255),
    is_pedestrian_zone BOOLEAN DEFAULT TRUE,
    nearest_sensor_id  INT REFERENCES sensor_locations(location_id),
    created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_graph_edge_pair UNIQUE (from_node_id, to_node_id)
);

CREATE INDEX idx_graph_edge_from ON graph_edge(from_node_id);
CREATE INDEX idx_graph_edge_to   ON graph_edge(to_node_id);

-- Named CBD places used for origin/destination selection.
CREATE TABLE IF NOT EXISTS cbd_landmark (
    landmark_id SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL UNIQUE,
    kind        VARCHAR(50)  NOT NULL,
    latitude    FLOAT NOT NULL,
    longitude   FLOAT NOT NULL
);

-- Average pedestrian count per sensor per weekday-hour.
-- dow follows PostgreSQL EXTRACT(DOW): 0 = Sunday .. 6 = Saturday.
CREATE TABLE IF NOT EXISTS sensor_hourly_profile (
    location_id  INT NOT NULL REFERENCES sensor_locations(location_id),
    dow          INT NOT NULL CHECK (dow BETWEEN 0 AND 6),
    hourday      INT NOT NULL CHECK (hourday BETWEEN 0 AND 23),
    avg_count    INT NOT NULL,
    sample_count INT NOT NULL,
    PRIMARY KEY (location_id, dow, hourday)
);

CREATE INDEX idx_profile_lookup ON sensor_hourly_profile(dow, hourday);
```

- [ ] **Step 2: Apply the migration**

Run: `psql -U postgres -d postgres -f db/epic1_graph.sql`
Expected: `DROP TABLE`/`CREATE TABLE`/`CREATE INDEX` notices, no errors.

- [ ] **Step 3: Verify the schema**

Run:
```bash
psql -U postgres -d postgres -c "\d graph_node" -c "\d cbd_landmark" -c "\d sensor_hourly_profile"
```
Expected: `graph_node.latitude` is `NOT NULL`; `cbd_landmark` and `sensor_hourly_profile` exist.

- [ ] **Step 4: Commit**

```bash
git add db/epic1_graph.sql
git commit -m "feat: add EPIC-1 graph, landmark and profile schema"
```

---

### Task 3: Build the sensor graph and hourly profile

**Files:**
- Create: `scripts/build_graph.py`
- Test: `backend/tests/integration/__init__.py`, `backend/tests/integration/test_graph_build.py`

**Interfaces:**
- Consumes: `db/epic1_graph.sql` tables; `app.config.get_settings`.
- Produces: `haversine_m(lat1, lon1, lat2, lon2) -> float`, `build_nodes(cur) -> int`, `build_edges(cur, k=4) -> int`, `build_profile(cur) -> int`, `seed_landmarks(cur) -> int`, all importable from `scripts.build_graph`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/integration/test_graph_build.py`:

```python
"""Integration tests: require the live database with EPIC-1 tables populated."""

import math
import os
import sys

import networkx as nx
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), "scripts"))

from app.db import get_cursor  # noqa: E402
from build_graph import haversine_m  # noqa: E402


def test_haversine_matches_known_distance():
    # Flinders Street Station to Federation Square is roughly 180 m.
    d = haversine_m(-37.8183, 144.9671, -37.8180, 144.9691)
    assert 150 < d < 220


def test_every_node_has_coordinates():
    with get_cursor() as cur:
        cur.execute("select count(*) as n from graph_node where latitude is null or longitude is null")
        assert cur.fetchone()["n"] == 0


def test_graph_is_connected():
    with get_cursor() as cur:
        cur.execute("select node_id from graph_node")
        nodes = [r["node_id"] for r in cur.fetchall()]
        cur.execute("select from_node_id, to_node_id from graph_edge")
        edges = [(r["from_node_id"], r["to_node_id"]) for r in cur.fetchall()]
    g = nx.Graph()
    g.add_nodes_from(nodes)
    g.add_edges_from(edges)
    assert nx.is_connected(g), f"graph has {nx.number_connected_components(g)} components"


def test_every_edge_endpoint_resolves_to_a_node():
    with get_cursor() as cur:
        cur.execute("""
            select count(*) as n from graph_edge e
            left join graph_node a on e.from_node_id = a.node_id
            left join graph_node b on e.to_node_id   = b.node_id
            where a.node_id is null or b.node_id is null
        """)
        assert cur.fetchone()["n"] == 0


def test_edges_have_positive_length():
    with get_cursor() as cur:
        cur.execute("select count(*) as n from graph_edge where length_meters is null or length_meters <= 0")
        assert cur.fetchone()["n"] == 0


def test_profile_covers_sensors_with_data():
    with get_cursor() as cur:
        cur.execute("select count(distinct location_id) as n from sensor_hourly_profile")
        assert cur.fetchone()["n"] >= 90


def test_landmarks_seeded_inside_bbox():
    with get_cursor() as cur:
        cur.execute("select count(*) as n from cbd_landmark")
        assert cur.fetchone()["n"] >= 20
        cur.execute("""
            select count(*) as n from cbd_landmark
            where latitude not between -37.832 and -37.784
               or longitude not between 144.923 and 144.992
        """)
        assert cur.fetchone()["n"] == 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/integration/test_graph_build.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'build_graph'`

- [ ] **Step 3: Write the builder**

Create `scripts/build_graph.py`:

```python
#!/usr/bin/env python3
"""Build the EPIC-1 routable graph and hourly profile.

Nodes are sensor locations (real coordinates). Edges join each sensor to its k
nearest neighbours, with any disconnected components bridged by nearest pair.
Re-runnable: truncates and rebuilds.

Run from the repository root:  python scripts/build_graph.py
"""

import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend"))

import psycopg2  # noqa: E402

from app.config import get_settings  # noqa: E402

K_NEIGHBOURS = 4

# Curated Melbourne CBD landmarks for origin/destination selection.
# Authored for this project; coordinates are the public locations of each place.
LANDMARKS = [
    ("Flinders Street Station", "station", -37.8183, 144.9671),
    ("Southern Cross Station", "station", -37.8183, 144.9525),
    ("Melbourne Central", "station", -37.8100, 144.9628),
    ("Parliament Station", "station", -37.8110, 144.9730),
    ("Federation Square", "landmark", -37.8180, 144.9691),
    ("State Library Victoria", "library", -37.8098, 144.9652),
    ("Queen Victoria Market", "market", -37.8076, 144.9568),
    ("Bourke Street Mall", "shopping", -37.8136, 144.9646),
    ("Melbourne Town Hall", "landmark", -37.8148, 144.9668),
    ("St Paul's Cathedral", "landmark", -37.8172, 144.9679),
    ("Chinatown", "precinct", -37.8114, 144.9686),
    ("Carlton Gardens", "park", -37.8051, 144.9713),
    ("Flagstaff Gardens", "park", -37.8110, 144.9548),
    ("Treasury Gardens", "park", -37.8134, 144.9752),
    ("Melbourne Museum", "museum", -37.8033, 144.9717),
    ("Old Melbourne Gaol", "museum", -37.8081, 144.9653),
    ("Immigration Museum", "museum", -37.8194, 144.9622),
    ("ACMI", "museum", -37.8177, 144.9689),
    ("Sea Life Melbourne", "attraction", -37.8210, 144.9581),
    ("Marvel Stadium", "stadium", -37.8165, 144.9475),
    ("Crown Melbourne", "entertainment", -37.8226, 144.9585),
    ("Eureka Skydeck", "attraction", -37.8214, 144.9645),
    ("RMIT City Campus", "education", -37.8079, 144.9634),
    ("University of Melbourne", "education", -37.7963, 144.9614),
    ("Docklands Library", "library", -37.8149, 144.9424),
    ("Southbank Promenade", "precinct", -37.8206, 144.9640),
]


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in metres."""
    radius = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlam / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(a))


def build_nodes(cur) -> int:
    """One graph node per sensor. Node id is the sensor's location_id."""
    cur.execute("DELETE FROM graph_edge")
    cur.execute("DELETE FROM graph_node")
    cur.execute("""
        INSERT INTO graph_node (node_id, latitude, longitude, node_type, sensor_id)
        SELECT location_id, latitude, longitude, 'sensor', location_id
        FROM sensor_locations
    """)
    return cur.rowcount


def _load_points(cur):
    cur.execute("SELECT node_id, latitude, longitude FROM graph_node ORDER BY node_id")
    return [(r[0], r[1], r[2]) for r in cur.fetchall()]


def build_edges(cur, k: int = K_NEIGHBOURS) -> int:
    """Join each node to its k nearest neighbours, then bridge any components."""
    pts = _load_points(cur)
    pairs = {}

    for a in pts:
        dists = sorted(
            (haversine_m(a[1], a[2], b[1], b[2]), b[0]) for b in pts if b[0] != a[0]
        )[:k]
        for dist, other in dists:
            key = (min(a[0], other), max(a[0], other))
            pairs[key] = dist

    # Bridge disconnected components by repeatedly linking the closest cross pair.
    import networkx as nx

    graph = nx.Graph()
    graph.add_nodes_from(p[0] for p in pts)
    graph.add_edges_from(pairs.keys())
    coords = {p[0]: (p[1], p[2]) for p in pts}

    while not nx.is_connected(graph):
        components = [set(c) for c in nx.connected_components(graph)]
        head = components[0]
        best = None
        for other in components[1:]:
            for u in head:
                for v in other:
                    d = haversine_m(*coords[u], *coords[v])
                    if best is None or d < best[0]:
                        best = (d, u, v)
        pairs[(min(best[1], best[2]), max(best[1], best[2]))] = best[0]
        graph.add_edge(best[1], best[2])

    rows = [(u, v, d, u) for (u, v), d in pairs.items()]
    cur.executemany(
        """
        INSERT INTO graph_edge (from_node_id, to_node_id, length_meters, nearest_sensor_id)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (from_node_id, to_node_id) DO NOTHING
        """,
        rows,
    )
    return len(rows)


def build_profile(cur) -> int:
    """Aggregate 1.5M hourly rows into one average per sensor per weekday-hour."""
    cur.execute("DELETE FROM sensor_hourly_profile")
    cur.execute("""
        INSERT INTO sensor_hourly_profile (location_id, dow, hourday, avg_count, sample_count)
        SELECT location_id,
               EXTRACT(DOW FROM sensing_date)::int AS dow,
               hourday,
               AVG(total_of_directions)::int,
               COUNT(*)
        FROM pedestrian_counts_hourly
        GROUP BY location_id, dow, hourday
    """)
    return cur.rowcount


def seed_landmarks(cur) -> int:
    """Insert the curated CBD landmark list. Idempotent on name."""
    cur.executemany(
        """
        INSERT INTO cbd_landmark (name, kind, latitude, longitude)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (name) DO UPDATE
          SET kind = EXCLUDED.kind,
              latitude = EXCLUDED.latitude,
              longitude = EXCLUDED.longitude
        """,
        LANDMARKS,
    )
    return len(LANDMARKS)


def main() -> None:
    settings = get_settings()
    conn = psycopg2.connect(
        host=settings.db_host,
        port=settings.db_port,
        dbname=settings.db_name,
        user=settings.db_user,
        password=settings.db_password,
    )
    cur = conn.cursor()

    print("Building EPIC-1 graph")
    print(f"  nodes:      {build_nodes(cur):,}")
    print(f"  edges:      {build_edges(cur):,}")
    print(f"  landmarks:  {seed_landmarks(cur):,}")
    print(f"  profile:    {build_profile(cur):,} rows")

    conn.commit()
    cur.close()
    conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run the builder**

Run: `python scripts/build_graph.py`
Expected: `nodes: 134`, `edges: ~345`, `landmarks: 26`, `profile: ~16,800 rows`

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/integration/test_graph_build.py -v`
Expected: 7 passed

- [ ] **Step 6: Commit**

```bash
git add scripts/build_graph.py backend/tests/integration/
git commit -m "feat: build sensor graph, landmarks and hourly profile"
```

---

### Task 4: GraphProvider interface and sensor implementation

**Files:**
- Create: `backend/app/graph/__init__.py`, `backend/app/graph/base.py`, `backend/app/graph/sensor_graph.py`
- Test: `backend/tests/unit/test_sensor_graph.py`

**Interfaces:**
- Consumes: `app.db.get_cursor`.
- Produces: `Node(node_id: int, lat: float, lon: float, sensor_id: int)`, `Edge(from_id: int, to_id: int, length_m: float)`, `GraphProvider` protocol with `nodes()`, `edges()`, `snap(lat, lon)`; `SensorGraphProvider` implementing it; `load_graph() -> SensorGraphProvider` (cached).

- [ ] **Step 1: Write the failing test**

Create `backend/tests/unit/test_sensor_graph.py`:

```python
from app.graph.base import Edge, Node
from app.graph.sensor_graph import SensorGraphProvider

NODES = [
    Node(node_id=1, lat=-37.8180, lon=144.9600, sensor_id=1),
    Node(node_id=2, lat=-37.8180, lon=144.9650, sensor_id=2),
    Node(node_id=3, lat=-37.8180, lon=144.9700, sensor_id=3),
]
EDGES = [Edge(from_id=1, to_id=2, length_m=440.0), Edge(from_id=2, to_id=3, length_m=440.0)]


def test_snap_returns_nearest_node():
    provider = SensorGraphProvider(NODES, EDGES)
    assert provider.snap(-37.8181, 144.9698).node_id == 3


def test_neighbours_are_bidirectional():
    provider = SensorGraphProvider(NODES, EDGES)
    assert {n for n, _ in provider.neighbours(2)} == {1, 3}


def test_neighbour_length_is_preserved():
    provider = SensorGraphProvider(NODES, EDGES)
    assert dict(provider.neighbours(1))[2] == 440.0


def test_node_lookup_by_id():
    provider = SensorGraphProvider(NODES, EDGES)
    assert provider.node(2).lon == 144.9650
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/unit/test_sensor_graph.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.graph'`

- [ ] **Step 3: Write the implementation**

Create empty `backend/app/graph/__init__.py`.

Create `backend/app/graph/base.py`:

```python
"""Graph abstractions. Swapping in real OSM geometry means implementing GraphProvider."""

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class Node:
    node_id: int
    lat: float
    lon: float
    sensor_id: int


@dataclass(frozen=True)
class Edge:
    from_id: int
    to_id: int
    length_m: float


class GraphProvider(Protocol):
    def nodes(self) -> list[Node]: ...

    def edges(self) -> list[Edge]: ...

    def node(self, node_id: int) -> Node: ...

    def neighbours(self, node_id: int) -> list[tuple[int, float]]: ...

    def snap(self, lat: float, lon: float) -> Node: ...
```

Create `backend/app/graph/sensor_graph.py`:

```python
"""Graph backed by sensor locations, loaded from graph_node / graph_edge."""

import math
from functools import lru_cache

from app.db import get_cursor
from app.graph.base import Edge, Node


def _squared_distance(a_lat: float, a_lon: float, b_lat: float, b_lon: float) -> float:
    """Cheap planar comparison, adequate for nearest-node snapping inside the CBD."""
    dlat = a_lat - b_lat
    dlon = (a_lon - b_lon) * math.cos(math.radians(a_lat))
    return dlat * dlat + dlon * dlon


class SensorGraphProvider:
    """In-memory adjacency over sensor nodes."""

    def __init__(self, nodes: list[Node], edges: list[Edge]) -> None:
        self._nodes = {n.node_id: n for n in nodes}
        self._edges = edges
        self._adj: dict[int, list[tuple[int, float]]] = {n.node_id: [] for n in nodes}
        for edge in edges:
            self._adj[edge.from_id].append((edge.to_id, edge.length_m))
            self._adj[edge.to_id].append((edge.from_id, edge.length_m))

    def nodes(self) -> list[Node]:
        return list(self._nodes.values())

    def edges(self) -> list[Edge]:
        return list(self._edges)

    def node(self, node_id: int) -> Node:
        return self._nodes[node_id]

    def neighbours(self, node_id: int) -> list[tuple[int, float]]:
        return self._adj.get(node_id, [])

    def snap(self, lat: float, lon: float) -> Node:
        """Nearest graph node to an arbitrary coordinate."""
        return min(
            self._nodes.values(),
            key=lambda n: _squared_distance(lat, lon, n.lat, n.lon),
        )


@lru_cache
def load_graph() -> SensorGraphProvider:
    """Load the graph from the database once per process."""
    with get_cursor() as cur:
        cur.execute("SELECT node_id, latitude, longitude, sensor_id FROM graph_node")
        nodes = [
            Node(node_id=r["node_id"], lat=r["latitude"], lon=r["longitude"], sensor_id=r["sensor_id"])
            for r in cur.fetchall()
        ]
        cur.execute("SELECT from_node_id, to_node_id, length_meters FROM graph_edge")
        edges = [
            Edge(from_id=r["from_node_id"], to_id=r["to_node_id"], length_m=r["length_meters"])
            for r in cur.fetchall()
        ]
    return SensorGraphProvider(nodes, edges)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/unit/test_sensor_graph.py -v`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/graph/ backend/tests/unit/test_sensor_graph.py
git commit -m "feat: add GraphProvider interface and sensor graph"
```

---

### Task 5: Hourly count profile service

**Files:**
- Create: `backend/app/services/__init__.py`, `backend/app/services/profile.py`
- Test: `backend/tests/unit/test_profile.py`

**Interfaces:**
- Consumes: `app.db.get_cursor`.
- Produces: `CountProfile` wrapping `dict[int, int]` (sensor_id → avg count) with `count_for(sensor_id) -> int | None`; `load_profile(dow: int, hour: int) -> CountProfile`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/unit/test_profile.py`:

```python
from app.services.profile import CountProfile


def test_returns_count_for_known_sensor():
    assert CountProfile({1: 300}).count_for(1) == 300


def test_returns_none_for_sensor_without_data():
    assert CountProfile({1: 300}).count_for(99) is None


def test_has_data_reflects_membership():
    profile = CountProfile({1: 300})
    assert profile.has_data(1) is True
    assert profile.has_data(99) is False


def test_empty_profile_returns_none():
    assert CountProfile({}).count_for(1) is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/unit/test_profile.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services'`

- [ ] **Step 3: Write the implementation**

Create empty `backend/app/services/__init__.py`.

Create `backend/app/services/profile.py`:

```python
"""Weekday-hour pedestrian count lookup, backed by sensor_hourly_profile."""

from dataclasses import dataclass

from app.db import get_cursor


@dataclass(frozen=True)
class CountProfile:
    """Average pedestrian counts for one weekday-hour, keyed by sensor id."""

    counts: dict

    def count_for(self, sensor_id: int):
        """Average count, or None when the sensor reported no data."""
        return self.counts.get(sensor_id)

    def has_data(self, sensor_id: int) -> bool:
        return sensor_id in self.counts


def load_profile(dow: int, hour: int) -> CountProfile:
    """Load every sensor's average count for the given weekday and hour."""
    with get_cursor() as cur:
        cur.execute(
            "SELECT location_id, avg_count FROM sensor_hourly_profile WHERE dow = %s AND hourday = %s",
            (dow, hour),
        )
        return CountProfile({r["location_id"]: r["avg_count"] for r in cur.fetchall()})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/unit/test_profile.py -v`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/ backend/tests/unit/test_profile.py
git commit -m "feat: add hourly count profile service"
```

---

### Task 6: Sensory scoring

Implements US 1.1 AC2, AC3, AC4 and US 1.2 AC1.

**Files:**
- Create: `backend/app/services/scoring.py`
- Test: `backend/tests/unit/test_scoring.py`

**Interfaces:**
- Consumes: `app.graph.base.Node/Edge`, `app.services.profile.CountProfile`.
- Produces: `edge_count(profile, node_a, node_b) -> float | None`; `classify(count, threshold) -> str` returning `"low"`/`"high"`; `is_congested(count, threshold) -> bool`; `RouteScore(level, score, peak_count, mean_count, coverage)`; `score_path(provider, profile, path, threshold, coverage_min) -> RouteScore`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/unit/test_scoring.py`:

```python
from app.graph.base import Edge, Node
from app.graph.sensor_graph import SensorGraphProvider
from app.services.profile import CountProfile
from app.services.scoring import classify, edge_count, is_congested, score_path

NODES = [
    Node(node_id=1, lat=-37.8180, lon=144.9600, sensor_id=1),
    Node(node_id=2, lat=-37.8180, lon=144.9650, sensor_id=2),
    Node(node_id=3, lat=-37.8180, lon=144.9700, sensor_id=3),
]
EDGES = [Edge(from_id=1, to_id=2, length_m=400.0), Edge(from_id=2, to_id=3, length_m=400.0)]
GRAPH = SensorGraphProvider(NODES, EDGES)


def test_classify_low_below_threshold():
    assert classify(499, 500) == "low"


def test_classify_high_at_threshold():
    # AC3 is explicit: equal to the threshold counts as High.
    assert classify(500, 500) == "high"


def test_corridor_flagged_at_threshold():
    assert is_congested(500, 500) is True
    assert is_congested(499, 500) is False


def test_edge_count_averages_both_endpoints():
    profile = CountProfile({1: 100, 2: 300})
    assert edge_count(profile, NODES[0], NODES[1]) == 200


def test_edge_count_uses_single_endpoint_when_other_missing():
    profile = CountProfile({1: 100})
    assert edge_count(profile, NODES[0], NODES[1]) == 100


def test_edge_count_is_none_when_both_missing():
    assert edge_count(CountProfile({}), NODES[0], NODES[1]) is None


def test_every_route_carries_sensory_level():
    profile = CountProfile({1: 100, 2: 100, 3: 100})
    assert score_path(GRAPH, profile, [1, 2, 3], 500, 0.5).level == "low"


def test_score_reports_peak_not_average():
    profile = CountProfile({1: 100, 2: 100, 3: 1400})
    score = score_path(GRAPH, profile, [1, 2, 3], 500, 0.5)
    # Edge 2-3 averages (100 + 1400) / 2 = 750, which is the peak and is High.
    assert score.peak_count == 750
    assert score.level == "high"


def test_uncovered_route_reports_unavailable():
    score = score_path(GRAPH, CountProfile({}), [1, 2, 3], 500, 0.5)
    assert score.level == "unavailable"
    assert score.coverage == 0.0


def test_partial_coverage_below_minimum_is_unavailable():
    # Only edge 1-2 has data, so coverage is 0.5 of length; the rule needs >= 0.5.
    profile = CountProfile({1: 100, 2: 100})
    score = score_path(GRAPH, profile, [1, 2, 3], 500, 0.75)
    assert score.level == "unavailable"


def test_coverage_is_length_weighted():
    profile = CountProfile({1: 100, 2: 100})
    score = score_path(GRAPH, profile, [1, 2, 3], 500, 0.5)
    assert score.coverage == 0.5
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/unit/test_scoring.py -v`
Expected: FAIL with `ImportError: cannot import name 'classify'`

- [ ] **Step 3: Write the implementation**

Create `backend/app/services/scoring.py`:

```python
"""Sensory classification and route-level congestion metrics."""

from dataclasses import dataclass

LEVEL_LOW = "low"
LEVEL_HIGH = "high"
LEVEL_UNAVAILABLE = "unavailable"


def classify(count: float, threshold: int) -> str:
    """US 1.1 AC3: below the threshold is Low, at or above it is High."""
    return LEVEL_HIGH if count >= threshold else LEVEL_LOW


def is_congested(count: float, threshold: int) -> bool:
    """US 1.2 AC1: a corridor is congested at or above the threshold."""
    return count >= threshold


def edge_count(profile, node_a, node_b):
    """Average count across an edge's endpoints, or None when neither reports."""
    values = [
        v
        for v in (profile.count_for(node_a.sensor_id), profile.count_for(node_b.sensor_id))
        if v is not None
    ]
    if not values:
        return None
    return sum(values) / len(values)


@dataclass(frozen=True)
class RouteScore:
    level: str
    score: float
    peak_count: float
    mean_count: float
    coverage: float


def score_path(provider, profile, path: list[int], threshold: int, coverage_min: float) -> RouteScore:
    """Score a node path: peak and mean counts, coverage, and Low/High/unavailable."""
    total_length = 0.0
    covered_length = 0.0
    weighted_sum = 0.0
    peak = 0.0

    for from_id, to_id in zip(path, path[1:]):
        node_a, node_b = provider.node(from_id), provider.node(to_id)
        length = dict(provider.neighbours(from_id))[to_id]
        total_length += length

        count = edge_count(profile, node_a, node_b)
        if count is None:
            continue
        covered_length += length
        weighted_sum += count * length
        peak = max(peak, count)

    coverage = (covered_length / total_length) if total_length else 0.0
    mean = (weighted_sum / covered_length) if covered_length else 0.0

    if coverage < coverage_min:
        return RouteScore(LEVEL_UNAVAILABLE, 0.0, 0.0, 0.0, round(coverage, 3))

    return RouteScore(
        level=classify(peak, threshold),
        score=round(peak / threshold, 3),
        peak_count=round(peak, 1),
        mean_count=round(mean, 1),
        coverage=round(coverage, 3),
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/unit/test_scoring.py -v`
Expected: 11 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/scoring.py backend/tests/unit/test_scoring.py
git commit -m "feat: add sensory scoring and congestion classification"
```

---

### Task 7: Route planner

**Files:**
- Create: `backend/app/services/planner.py`
- Test: `backend/tests/unit/test_planner.py`

**Interfaces:**
- Consumes: `SensorGraphProvider`, `CountProfile`, `scoring.edge_count`.
- Produces: `shortest_path(provider, start, goal, cost_fn) -> list[int] | None`; `distance_cost(provider) -> cost_fn`; `sensory_cost(provider, profile, threshold) -> cost_fn`; `path_length_m(provider, path) -> float`; `NEUTRAL_RATIO = 0.5`; `PENALTY_WEIGHT = 2.0`; `PENALTY_CAP = 4.0`. A `cost_fn` has signature `(from_id: int, to_id: int, length_m: float) -> float`, returning `math.inf` to exclude an edge.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/unit/test_planner.py`:

```python
import math

from app.graph.base import Edge, Node
from app.graph.sensor_graph import SensorGraphProvider
from app.services.planner import (
    distance_cost,
    path_length_m,
    sensory_cost,
    shortest_path,
)
from app.services.profile import CountProfile

# Diamond graph: 1 -> 2 -> 4 is short but busy; 1 -> 3 -> 4 is longer but quiet.
NODES = [
    Node(node_id=1, lat=-37.8180, lon=144.9600, sensor_id=1),
    Node(node_id=2, lat=-37.8170, lon=144.9650, sensor_id=2),
    Node(node_id=3, lat=-37.8190, lon=144.9650, sensor_id=3),
    Node(node_id=4, lat=-37.8180, lon=144.9700, sensor_id=4),
]
EDGES = [
    Edge(from_id=1, to_id=2, length_m=100.0),
    Edge(from_id=2, to_id=4, length_m=100.0),
    Edge(from_id=1, to_id=3, length_m=150.0),
    Edge(from_id=3, to_id=4, length_m=150.0),
]
GRAPH = SensorGraphProvider(NODES, EDGES)
QUIET = CountProfile({1: 50, 2: 2000, 3: 50, 4: 50})


def test_shortest_path_picks_the_short_branch():
    assert shortest_path(GRAPH, 1, 4, distance_cost(GRAPH)) == [1, 2, 4]


def test_sensory_cost_avoids_the_busy_branch():
    assert shortest_path(GRAPH, 1, 4, sensory_cost(GRAPH, QUIET, 500)) == [1, 3, 4]


def test_path_length_sums_edges():
    assert path_length_m(GRAPH, [1, 2, 4]) == 200.0


def test_returns_none_when_no_path_exists():
    isolated = SensorGraphProvider(
        NODES + [Node(node_id=9, lat=-37.80, lon=144.90, sensor_id=9)], EDGES
    )
    assert shortest_path(isolated, 1, 9, distance_cost(isolated)) is None


def test_excluded_edges_are_unreachable():
    def blocked(from_id, to_id, length_m):
        return math.inf

    assert shortest_path(GRAPH, 1, 4, blocked) is None


def test_same_start_and_goal_returns_single_node():
    assert shortest_path(GRAPH, 1, 1, distance_cost(GRAPH)) == [1]


def test_uncovered_edge_gets_neutral_not_free_cost():
    empty = CountProfile({})
    cost = sensory_cost(GRAPH, empty, 500)
    # Neutral ratio 0.5 with weight 2.0 gives a multiplier of 1 + 2.0 * 0.5 = 2.0.
    assert cost(1, 2, 100.0) == 200.0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/unit/test_planner.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.planner'`

- [ ] **Step 3: Write the implementation**

Create `backend/app/services/planner.py`:

```python
"""Dijkstra path finding with pluggable edge cost."""

import heapq
import math

from app.services.scoring import edge_count

# An edge with no sensor data is treated as half the threshold: not free, not punished.
NEUTRAL_RATIO = 0.5
# How hard congestion is penalised relative to distance.
PENALTY_WEIGHT = 2.0
# Ceiling so one extreme sensor cannot make a corridor infinitely expensive.
PENALTY_CAP = 4.0


def shortest_path(provider, start: int, goal: int, cost_fn):
    """Least-cost node path, or None when the goal is unreachable."""
    if start == goal:
        return [start]

    best = {start: 0.0}
    previous: dict = {}
    queue = [(0.0, start)]
    seen = set()

    while queue:
        cost, node = heapq.heappop(queue)
        if node in seen:
            continue
        seen.add(node)
        if node == goal:
            break
        for neighbour, length in provider.neighbours(node):
            if neighbour in seen:
                continue
            step = cost_fn(node, neighbour, length)
            if step == math.inf:
                continue
            candidate = cost + step
            if candidate < best.get(neighbour, math.inf):
                best[neighbour] = candidate
                previous[neighbour] = node
                heapq.heappush(queue, (candidate, neighbour))

    if goal not in best:
        return None

    path = [goal]
    while path[-1] != start:
        path.append(previous[path[-1]])
    return list(reversed(path))


def distance_cost(provider):
    """Plain distance: the fastest walking route."""

    def cost(from_id, to_id, length_m):
        return length_m

    return cost


def sensory_cost(provider, profile, threshold: int, excluded: set | None = None):
    """Distance inflated by how crowded the edge is.

    Edges in `excluded` are unusable, which is how congestion avoidance is expressed.
    """
    excluded = excluded or set()

    def cost(from_id, to_id, length_m):
        if (min(from_id, to_id), max(from_id, to_id)) in excluded:
            return math.inf
        count = edge_count(profile, provider.node(from_id), provider.node(to_id))
        ratio = NEUTRAL_RATIO if count is None else count / threshold
        return length_m * (1 + PENALTY_WEIGHT * min(ratio, PENALTY_CAP))

    return cost


def path_length_m(provider, path: list[int]) -> float:
    """Total walking distance along a node path."""
    total = 0.0
    for from_id, to_id in zip(path, path[1:]):
        total += dict(provider.neighbours(from_id))[to_id]
    return total
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/unit/test_planner.py -v`
Expected: 7 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/planner.py backend/tests/unit/test_planner.py
git commit -m "feat: add dijkstra route planner with sensory cost"
```

---

### Task 8: Alternatives, avoidance and warnings

Implements US 1.2 AC2, AC3, AC4 and US 1.3 AC2, AC3, AC4.

**Files:**
- Modify: `backend/app/services/planner.py` (append)
- Test: `backend/tests/unit/test_alternatives.py`

**Interfaces:**
- Consumes: everything from Task 7.
- Produces: `WARN_UNAVAILABLE`, `WARN_NO_ALTERNATIVE`, `WARN_EXCEEDS` string constants; `PlannedRoute(route_id, kind, path, distance_m, duration_min, score)`; `PlanResult(routes: list[PlannedRoute], warnings: list[dict])`; `plan_routes(provider, profile, start, goal, threshold, coverage_min, walk_speed_mps) -> PlanResult`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/unit/test_alternatives.py`:

```python
from app.graph.base import Edge, Node
from app.graph.sensor_graph import SensorGraphProvider
from app.services.planner import (
    WARN_EXCEEDS,
    WARN_NO_ALTERNATIVE,
    WARN_UNAVAILABLE,
    plan_routes,
)
from app.services.profile import CountProfile

NODES = [
    Node(node_id=1, lat=-37.8180, lon=144.9600, sensor_id=1),
    Node(node_id=2, lat=-37.8170, lon=144.9650, sensor_id=2),
    Node(node_id=3, lat=-37.8190, lon=144.9650, sensor_id=3),
    Node(node_id=4, lat=-37.8180, lon=144.9700, sensor_id=4),
]
EDGES = [
    Edge(from_id=1, to_id=2, length_m=100.0),
    Edge(from_id=2, to_id=4, length_m=100.0),
    Edge(from_id=1, to_id=3, length_m=150.0),
    Edge(from_id=3, to_id=4, length_m=150.0),
]
GRAPH = SensorGraphProvider(NODES, EDGES)


def codes(result):
    return {w["code"] for w in result.warnings}


def test_routes_returns_selectable_routes():
    profile = CountProfile({1: 50, 2: 50, 3: 50, 4: 50})
    result = plan_routes(GRAPH, profile, 1, 4, 500, 0.5, 1.35)
    assert len(result.routes) >= 1
    assert all(r.route_id for r in result.routes)


def test_alternative_avoids_congested_edge():
    # Node 2 is heavily crowded, so the quiet route must detour via node 3.
    profile = CountProfile({1: 50, 2: 2000, 3: 50, 4: 50})
    result = plan_routes(GRAPH, profile, 1, 4, 500, 0.5, 1.35)
    quiet = next(r for r in result.routes if r.kind == "quiet")
    assert quiet.path == [1, 3, 4]


def test_alternative_peak_strictly_lower():
    profile = CountProfile({1: 50, 2: 2000, 3: 50, 4: 50})
    result = plan_routes(GRAPH, profile, 1, 4, 500, 0.5, 1.35)
    quiet = next(r for r in result.routes if r.kind == "quiet")
    direct = next(r for r in result.routes if r.kind == "direct")
    assert quiet.score.peak_count < direct.score.peak_count


def test_no_lower_congestion_route_warning():
    # Every node is over the threshold, so no detour can help.
    profile = CountProfile({1: 900, 2: 900, 3: 900, 4: 900})
    result = plan_routes(GRAPH, profile, 1, 4, 500, 0.5, 1.35)
    assert WARN_NO_ALTERNATIVE in codes(result)


def test_exceeds_preferred_threshold_warning():
    profile = CountProfile({1: 900, 2: 900, 3: 900, 4: 900})
    result = plan_routes(GRAPH, profile, 1, 4, 500, 0.5, 1.35)
    assert WARN_EXCEEDS in codes(result)


def test_offers_lower_congestion_alternative():
    profile = CountProfile({1: 50, 2: 2000, 3: 50, 4: 50})
    result = plan_routes(GRAPH, profile, 1, 4, 500, 0.5, 1.35)
    assert WARN_NO_ALTERNATIVE not in codes(result)
    assert len(result.routes) == 2


def test_no_alternative_warning_when_quiet_equals_direct():
    # Uniform low counts: the quiet route is the direct route, and that is fine.
    profile = CountProfile({1: 50, 2: 50, 3: 50, 4: 50})
    result = plan_routes(GRAPH, profile, 1, 4, 500, 0.5, 1.35)
    assert WARN_EXCEEDS not in codes(result)


def test_uncovered_route_raises_unavailable_warning():
    result = plan_routes(GRAPH, CountProfile({}), 1, 4, 500, 0.5, 1.35)
    assert WARN_UNAVAILABLE in codes(result)
    assert result.routes[0].score.level == "unavailable"


def test_route_changes_with_threshold():
    # A high tolerance accepts the short busy path; a low one detours.
    profile = CountProfile({1: 50, 2: 700, 3: 50, 4: 50})
    tolerant = plan_routes(GRAPH, profile, 1, 4, 1000, 0.5, 1.35)
    strict = plan_routes(GRAPH, profile, 1, 4, 250, 0.5, 1.35)
    tolerant_quiet = next(r for r in tolerant.routes if r.kind == "quiet")
    strict_quiet = next(r for r in strict.routes if r.kind == "quiet")
    assert tolerant_quiet.path != strict_quiet.path


def test_duration_uses_walking_speed():
    profile = CountProfile({1: 50, 2: 50, 3: 50, 4: 50})
    result = plan_routes(GRAPH, profile, 1, 4, 500, 0.5, 1.35)
    direct = next(r for r in result.routes if r.kind == "direct")
    # 200 m at 1.35 m/s is 148 s, which rounds up to 3 minutes.
    assert direct.duration_min == 3
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/unit/test_alternatives.py -v`
Expected: FAIL with `ImportError: cannot import name 'plan_routes'`

- [ ] **Step 3: Append the implementation**

Append to `backend/app/services/planner.py`:

```python
import math as _math
from dataclasses import dataclass as _dataclass

from app.services.scoring import LEVEL_UNAVAILABLE, is_congested, score_path

WARN_UNAVAILABLE = "SENSORY_DATA_UNAVAILABLE"
WARN_NO_ALTERNATIVE = "NO_LOWER_CONGESTION_ROUTE"
WARN_EXCEEDS = "EXCEEDS_PREFERRED_THRESHOLD"

WARNING_MESSAGES = {
    WARN_UNAVAILABLE: "Sensory information unavailable",
    WARN_NO_ALTERNATIVE: "No lower-congestion route is currently available",
    WARN_EXCEEDS: "This route exceeds your preferred crowd level",
}


@_dataclass(frozen=True)
class PlannedRoute:
    route_id: str
    kind: str
    path: list
    distance_m: float
    duration_min: int
    score: object


@_dataclass(frozen=True)
class PlanResult:
    routes: list
    warnings: list


def _congested_edges(provider, profile, threshold: int) -> set:
    """Edge keys at or above the threshold (US 1.2 AC1)."""
    congested = set()
    for edge in provider.edges():
        count = edge_count(profile, provider.node(edge.from_id), provider.node(edge.to_id))
        if count is not None and is_congested(count, threshold):
            congested.add((min(edge.from_id, edge.to_id), max(edge.from_id, edge.to_id)))
    return congested


def _build(provider, profile, path, kind, threshold, coverage_min, walk_speed_mps):
    distance = path_length_m(provider, path)
    return PlannedRoute(
        route_id=f"{kind}-{path[0]}-{path[-1]}",
        kind=kind,
        path=path,
        distance_m=round(distance, 1),
        duration_min=max(1, _math.ceil(distance / walk_speed_mps / 60)),
        score=score_path(provider, profile, path, threshold, coverage_min),
    )


def plan_routes(provider, profile, start, goal, threshold, coverage_min, walk_speed_mps):
    """Plan a direct route and the least-sensory alternative, with warnings."""
    warnings = []

    direct_path = shortest_path(provider, start, goal, distance_cost(provider))
    if direct_path is None:
        return PlanResult([], [{"code": WARN_NO_ALTERNATIVE,
                                "message": WARNING_MESSAGES[WARN_NO_ALTERNATIVE]}])

    direct = _build(provider, profile, direct_path, "direct", threshold,
                    coverage_min, walk_speed_mps)

    quiet_path = shortest_path(provider, start, goal, sensory_cost(provider, profile, threshold))
    quiet = _build(provider, profile, quiet_path, "quiet", threshold,
                   coverage_min, walk_speed_mps)

    # US 1.2 AC2: if the quiet route is still congested, replan avoiding congested edges.
    if quiet.score.level != LEVEL_UNAVAILABLE and quiet.score.peak_count >= threshold:
        excluded = _congested_edges(provider, profile, threshold)
        avoid_path = shortest_path(
            provider, start, goal, sensory_cost(provider, profile, threshold, excluded)
        )
        replacement = None
        if avoid_path is not None:
            candidate = _build(provider, profile, avoid_path, "quiet", threshold,
                               coverage_min, walk_speed_mps)
            # US 1.2 AC4: only offer it if congestion is genuinely lower.
            if candidate.score.peak_count < quiet.score.peak_count:
                replacement = candidate
        if replacement is not None:
            quiet = replacement
        else:
            warnings.append({"code": WARN_NO_ALTERNATIVE,
                             "message": WARNING_MESSAGES[WARN_NO_ALTERNATIVE]})

    # US 1.3 AC2: tell the user when the recommended route still exceeds their preference.
    if quiet.score.level != LEVEL_UNAVAILABLE and quiet.score.peak_count >= threshold:
        warnings.append({"code": WARN_EXCEEDS, "message": WARNING_MESSAGES[WARN_EXCEEDS]})

    # US 1.1 AC4: missing pedestrian data.
    if quiet.score.level == LEVEL_UNAVAILABLE:
        warnings.append({"code": WARN_UNAVAILABLE,
                         "message": WARNING_MESSAGES[WARN_UNAVAILABLE]})

    routes = [quiet] if quiet.path == direct.path else [quiet, direct]
    return PlanResult(routes, warnings)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/unit/ -v`
Expected: all unit tests pass, including 10 in `test_alternatives.py`

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/planner.py backend/tests/unit/test_alternatives.py
git commit -m "feat: add congestion avoidance, alternatives and warnings"
```

---

### Task 9: Places endpoint

Implements the origin/destination half of US 1.1 AC1.

**Files:**
- Create: `backend/app/schemas.py`, `backend/app/routers/places.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/integration/test_api_places.py`

**Interfaces:**
- Consumes: `cbd_landmark` table, `app.db.get_cursor`.
- Produces: pydantic models `PlaceOut(id: int, name: str, kind: str, lat: float, lng: float)`, `PlacesResponse(places: list[PlaceOut])`, `SensoryOut`, `CongestionOut`, `RouteOut`, `WarningOut`, `RoutesResponse`; route `GET /api/places`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/integration/test_api_places.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/integration/test_api_places.py -v`
Expected: FAIL — 404 on `/api/places`

- [ ] **Step 3: Write the implementation**

Create `backend/app/schemas.py`:

```python
"""API response models."""

from pydantic import BaseModel


class PlaceOut(BaseModel):
    id: int
    name: str
    kind: str
    lat: float
    lng: float


class PlacesResponse(BaseModel):
    places: list[PlaceOut]


class SensoryOut(BaseModel):
    level: str
    score: float
    peak_count: float
    coverage: float


class CongestionOut(BaseModel):
    peak: float
    mean: float


class RouteOut(BaseModel):
    id: str
    type: str
    path: list[list[float]]
    distance_m: float
    duration_min: int
    sensory: SensoryOut
    congestion: CongestionOut


class WarningOut(BaseModel):
    code: str
    message: str


class RoutesResponse(BaseModel):
    routes: list[RouteOut]
    warnings: list[WarningOut]
    threshold_used: int
```

Create `backend/app/routers/places.py`:

```python
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
                "SELECT landmark_id, name, kind, latitude, longitude FROM cbd_landmark ORDER BY name"
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
```

Modify `backend/app/main.py` — replace the import and registration lines:

```python
from app.routers import health, places

app.include_router(health.router, prefix="/api")
app.include_router(places.router, prefix="/api")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/integration/test_api_places.py -v`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas.py backend/app/routers/places.py backend/app/main.py backend/tests/integration/test_api_places.py
git commit -m "feat: add CBD landmark places endpoint"
```

---

### Task 10: Routes endpoint

**Files:**
- Create: `backend/app/routers/routes.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/integration/test_api_routes.py`

**Interfaces:**
- Consumes: `load_graph`, `load_profile`, `plan_routes`, schemas from Task 9.
- Produces: route `GET /api/routes` returning `RoutesResponse`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/integration/test_api_routes.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/integration/test_api_routes.py -v`
Expected: FAIL — 404 on `/api/routes`

- [ ] **Step 3: Write the implementation**

Create `backend/app/routers/routes.py`:

```python
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
            "SELECT landmark_id, name, latitude, longitude FROM cbd_landmark WHERE landmark_id = %s",
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
```

Modify `backend/app/main.py`:

```python
from app.routers import health, places, routes

app.include_router(health.router, prefix="/api")
app.include_router(places.router, prefix="/api")
app.include_router(routes.router, prefix="/api")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/ -v`
Expected: all tests pass

- [ ] **Step 5: Verify by hand**

Run: `cd backend && uvicorn app.main:app --port 8000` then in another shell:
```bash
curl -s "http://localhost:8000/api/health"
curl -s "http://localhost:8000/api/routes?origin_id=1&destination_id=2&dow=2&hour=17"
```
Expected: health reports 134 nodes; routes returns a `routes` array with `path` coordinate pairs.

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/routes.py backend/app/main.py backend/tests/integration/test_api_routes.py
git commit -m "feat: add sensory route planning endpoint"
```

---

### Task 11: Frontend API layer

**Files:**
- Modify (currently empty): `frontend/src/api/types.ts`, `frontend/src/api/client.ts`
- Create: `frontend/.env.example`

**Interfaces:**
- Consumes: the JSON contract from Tasks 9 and 10.
- Produces: TS types `Place`, `Sensory`, `Congestion`, `ApiRoute`, `ApiWarning`, `RoutesResponse`, `LatLng`; functions `fetchPlaces(q?: string): Promise<Place[]>` and `fetchRoutes(params): Promise<RoutesResponse>`.

- [ ] **Step 1: Write the types**

Write `frontend/src/api/types.ts`:

```typescript
export type LatLng = [number, number]

export interface Place {
  id: number
  name: string
  kind: string
  lat: number
  lng: number
}

export interface Sensory {
  level: 'low' | 'high' | 'unavailable'
  score: number
  peak_count: number
  coverage: number
}

export interface Congestion {
  peak: number
  mean: number
}

export interface ApiRoute {
  id: string
  type: 'quiet' | 'direct'
  path: LatLng[]
  distance_m: number
  duration_min: number
  sensory: Sensory
  congestion: Congestion
}

export interface ApiWarning {
  code: 'SENSORY_DATA_UNAVAILABLE' | 'NO_LOWER_CONGESTION_ROUTE' | 'EXCEEDS_PREFERRED_THRESHOLD'
  message: string
}

export interface RoutesResponse {
  routes: ApiRoute[]
  warnings: ApiWarning[]
  threshold_used: number
}

export interface RouteQuery {
  originId: number
  destinationId: number
  threshold?: number
  dow?: number
  hour?: number
}
```

- [ ] **Step 2: Write the client**

Write `frontend/src/api/client.ts`:

```typescript
import type { Place, RouteQuery, RoutesResponse } from './types'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

async function getJson<T>(path: string, params: Record<string, string>): Promise<T> {
  const query = new URLSearchParams(params).toString()
  const response = await fetch(`${BASE_URL}${path}${query ? `?${query}` : ''}`)
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}): ${path}`)
  }
  return (await response.json()) as T
}

export async function fetchPlaces(q = ''): Promise<Place[]> {
  const body = await getJson<{ places: Place[] }>('/api/places', q ? { q } : {})
  return body.places
}

export async function fetchRoutes(query: RouteQuery): Promise<RoutesResponse> {
  const params: Record<string, string> = {
    origin_id: String(query.originId),
    destination_id: String(query.destinationId),
  }
  if (query.threshold !== undefined) params.threshold = String(query.threshold)
  if (query.dow !== undefined) params.dow = String(query.dow)
  if (query.hour !== undefined) params.hour = String(query.hour)
  return getJson<RoutesResponse>('/api/routes', params)
}
```

Create `frontend/.env.example`:

```
VITE_API_URL=http://localhost:8000
```

- [ ] **Step 3: Verify it type-checks**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/ frontend/.env.example
git commit -m "feat: add typed API client for the HushWay backend"
```

---

### Task 12: Frontend hooks

Implements US 1.3 AC1 (preference saved) and AC5 (route updates on change).

**Files:**
- Modify (currently empty): `frontend/src/hooks/useSensitivity.ts`, `frontend/src/hooks/useRoute.ts`

**Interfaces:**
- Consumes: `fetchRoutes` from Task 11.
- Produces: `useSensitivity()` returning `{ density, setDensity, threshold }` where `density` is `'low' | 'mid' | 'high'`; `useRoute(originId, destinationId, threshold)` returning `{ data, loading, error }` with `data: RoutesResponse | null`.

- [ ] **Step 1: Write the sensitivity hook**

Write `frontend/src/hooks/useSensitivity.ts`:

```typescript
import { useCallback, useState } from 'react'

export type Density = 'low' | 'mid' | 'high'

// Mirrors PREFERENCE_THRESHOLDS in backend/app/config.py.
export const DENSITY_THRESHOLDS: Record<Density, number> = {
  low: 250,
  mid: 500,
  high: 1000,
}

const STORAGE_KEY = 'hushway.density'

function readStored(): Density {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'low' || stored === 'mid' || stored === 'high' ? stored : 'mid'
}

/** Crowd preference, persisted across sessions (US 1.3 AC1). */
export function useSensitivity() {
  const [density, setDensityState] = useState<Density>(readStored)

  const setDensity = useCallback((next: Density) => {
    setDensityState(next)
    localStorage.setItem(STORAGE_KEY, next)
  }, [])

  return { density, setDensity, threshold: DENSITY_THRESHOLDS[density] }
}
```

- [ ] **Step 2: Write the route hook**

Write `frontend/src/hooks/useRoute.ts`:

```typescript
import { useEffect, useState } from 'react'
import { fetchRoutes } from '../api/client'
import type { RoutesResponse } from '../api/types'

/**
 * Fetch routes for the given trip. Re-runs whenever the threshold changes,
 * which is what keeps the recommendation current (US 1.3 AC5).
 */
export function useRoute(
  originId: number | null,
  destinationId: number | null,
  threshold: number,
) {
  const [data, setData] = useState<RoutesResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (originId === null || destinationId === null) {
      setData(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    fetchRoutes({ originId, destinationId, threshold })
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [originId, destinationId, threshold])

  return { data, loading, error }
}
```

- [ ] **Step 3: Verify it type-checks**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/
git commit -m "feat: add sensitivity and route hooks"
```

---

### Task 13: SensoryBadge and SearchPanel wiring

Implements US 1.1 AC2 (visible indicator) and US 1.3 AC1 (preference drives the query).

**Files:**
- Modify (currently empty): `frontend/src/components/SensoryBadge.tsx`
- Create: `frontend/src/components/SensoryBadge.css`
- Modify: `frontend/src/components/SearchPanel.tsx`

**Interfaces:**
- Consumes: `Sensory` type, `Density` type, `fetchPlaces`.
- Produces: `<SensoryBadge level={...} />`; `SearchPanel` props `{ places, originId, destinationId, density, onOriginChange, onDestinationChange, onDensityChange }`.

- [ ] **Step 1: Write the badge**

Write `frontend/src/components/SensoryBadge.tsx`:

```tsx
import './SensoryBadge.css'
import type { Sensory } from '../api/types'

const LABELS: Record<Sensory['level'], string> = {
  low: 'Low Sensory',
  high: 'High Sensory',
  unavailable: 'Sensory information unavailable',
}

export default function SensoryBadge({ level }: { level: Sensory['level'] }) {
  return <span className={`sensory-badge sensory-badge--${level}`}>{LABELS[level]}</span>
}
```

Create `frontend/src/components/SensoryBadge.css`:

```css
.sensory-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.6;
}

.sensory-badge--low {
  background: rgba(94, 227, 156, 0.16);
  color: #2f8f5b;
}

.sensory-badge--high {
  background: rgba(194, 42, 42, 0.14);
  color: #c22a2a;
}

.sensory-badge--unavailable {
  background: rgba(120, 120, 120, 0.16);
  color: #6b6b6b;
}
```

- [ ] **Step 2: Convert SearchPanel to a controlled component**

In `frontend/src/components/SearchPanel.tsx`, replace the `useState` block and the two
text inputs. Keep the existing markup, classes and travel-mode section untouched.

Replace the imports and component signature:

```tsx
import { useState } from 'react'
import {
  ArrowLeft, Bookmark, Mic, Car, Bus, Footprints, Accessibility,
  User, Users, type LucideIcon,
} from 'lucide-react'
import type { Place } from '../api/types'
import type { Density } from '../hooks/useSensitivity'
import './SearchPanel.css'

type TravelMode = 'drive' | 'transit' | 'walk' | 'accessible'

const modes: { id: TravelMode; label: string; Icon: LucideIcon }[] = [
  { id: 'drive', label: 'Drive', Icon: Car },
  { id: 'transit', label: 'Transit', Icon: Bus },
  { id: 'walk', label: 'Walk', Icon: Footprints },
  { id: 'accessible', label: 'Accessible', Icon: Accessibility },
]

const densities: { id: Density; label: string; Icon: LucideIcon }[] = [
  { id: 'low', label: 'Low', Icon: User },
  { id: 'mid', label: 'Mid', Icon: Users },
  { id: 'high', label: 'High', Icon: Users },
]

interface SearchPanelProps {
  places: Place[]
  originId: number | null
  destinationId: number | null
  density: Density
  onOriginChange: (id: number | null) => void
  onDestinationChange: (id: number | null) => void
  onDensityChange: (density: Density) => void
}

export default function SearchPanel({
  places, originId, destinationId, density,
  onOriginChange, onDestinationChange, onDensityChange,
}: SearchPanelProps) {
  const [mode, setMode] = useState<TravelMode>('walk')
```

Replace the `sp__inputs` block with landmark selects:

```tsx
        <div className="sp__inputs">
          <div className="sp__input">
            <select
              aria-label="Origin"
              value={originId ?? ''}
              onChange={(e) => onOriginChange(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Choose a starting point</option>
              {places.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="sp__input">
            <select
              aria-label="Destination"
              value={destinationId ?? ''}
              onChange={(e) => onDestinationChange(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Choose a destination</option>
              {places.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <button className="sp__input-btn" aria-label="Voice"><Mic size={16} /></button>
        </div>
```

Replace the density button handler so it calls the prop:

```tsx
            <button
              key={id}
              role="tab"
              aria-selected={density === id}
              className={`sp__density${density === id ? ' sp__density--active' : ''}`}
              onClick={() => onDensityChange(id)}
            >
```

Add select styling to `frontend/src/components/SearchPanel.css`:

```css
.sp__input select {
  width: 100%;
  border: none;
  background: transparent;
  font: inherit;
  color: inherit;
  padding: 10px 12px;
  cursor: pointer;
}
```

- [ ] **Step 3: Verify it type-checks**

Run: `cd frontend && npx tsc --noEmit`
Expected: one error in `RouteCompare.tsx` — `SearchPanel` now requires props. Task 14 fixes it.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/SensoryBadge.tsx frontend/src/components/SensoryBadge.css frontend/src/components/SearchPanel.tsx frontend/src/components/SearchPanel.css
git commit -m "feat: add sensory badge and controlled search panel"
```

---

### Task 14: Wire RouteCompare to live data

Implements US 1.1 AC1 end to end, plus warning display for US 1.2 AC3 and US 1.3 AC2/AC4.

**Files:**
- Modify: `frontend/src/pages/RouteCompare.tsx`, `frontend/src/components/RouteCard.tsx`, `frontend/src/components/MapView.tsx`

**Interfaces:**
- Consumes: `useSensitivity`, `useRoute`, `fetchPlaces`, `SensoryBadge`, `ApiRoute`.
- Produces: `RouteCard` props `{ route: ApiRoute; recommended: boolean }`; `MapView` props `{ routes?: ApiRoute[]; center?: LatLng }`.

- [ ] **Step 1: Rewrite RouteCompare**

Write `frontend/src/pages/RouteCompare.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { Cloud } from 'lucide-react'
import Header from '../components/Header'
import SearchPanel from '../components/SearchPanel'
import RouteCard from '../components/RouteCard'
import MapView from '../components/MapView'
import WarningBanner from '../components/WarningBanner'
import { fetchPlaces } from '../api/client'
import type { Place } from '../api/types'
import { useRoute } from '../hooks/useRoute'
import { useSensitivity } from '../hooks/useSensitivity'
import { weather } from '../mockData'
import './RouteCompare.css'

export default function RouteCompare() {
  const [places, setPlaces] = useState<Place[]>([])
  const [originId, setOriginId] = useState<number | null>(null)
  const [destinationId, setDestinationId] = useState<number | null>(null)
  const { density, setDensity, threshold } = useSensitivity()
  const { data, loading, error } = useRoute(originId, destinationId, threshold)

  useEffect(() => {
    fetchPlaces().then(setPlaces).catch(() => setPlaces([]))
  }, [])

  const routes = data?.routes ?? []
  const warnings = data?.warnings ?? []

  return (
    <div className="app-shell">
      <Header />
      <div className="map-page">
        <aside className="sidebar">
          <SearchPanel
            places={places}
            originId={originId}
            destinationId={destinationId}
            density={density}
            onOriginChange={setOriginId}
            onDestinationChange={setDestinationId}
            onDensityChange={setDensity}
          />

          {loading && <p className="rc-page__status">Finding calmer routes…</p>}
          {error && <p className="rc-page__status">Could not reach the route service.</p>}
          {!loading && !error && originId === null && (
            <p className="rc-page__status">Choose a starting point and destination.</p>
          )}

          {routes.map((r, i) => (
            <RouteCard key={r.id} route={r} recommended={i === 0} />
          ))}
        </aside>

        <main className="map-area">
          <MapView routes={routes} />

          <div className="rc-page__overlay-top">
            <div className="rc-page__warning-wrap">
              {warnings.map((w) => (
                <WarningBanner key={w.code} title="Warning" message={w.message} />
              ))}
            </div>
            <div className="rc-page__weather">
              <Cloud size={16} />
              <span>{weather.temperatureC}°</span>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
```

Append to `frontend/src/pages/RouteCompare.css`:

```css
.rc-page__status {
  padding: 12px 16px;
  color: var(--text-muted, #6b6b6b);
  font-size: 14px;
}
```

- [ ] **Step 2: Rewrite RouteCard**

Write `frontend/src/components/RouteCard.tsx`:

```tsx
import SensoryBadge from './SensoryBadge'
import type { ApiRoute } from '../api/types'
import './RouteCard.css'

const TITLES: Record<ApiRoute['type'], string> = {
  quiet: 'Quiet Route',
  direct: 'Fastest Route',
}

export default function RouteCard({
  route,
  recommended,
}: {
  route: ApiRoute
  recommended: boolean
}) {
  const km = (route.distance_m / 1000).toFixed(1)

  return (
    <article className={`route-card${recommended ? ' route-card--recommended' : ''}`}>
      <header className="route-card__head">
        <h3 className="route-card__title">{TITLES[route.type]}</h3>
        {recommended && <span className="route-card__flag">Recommended</span>}
      </header>

      <p className="route-card__meta">
        {route.duration_min} min · {km} km
      </p>

      <SensoryBadge level={route.sensory.level} />

      {route.sensory.level !== 'unavailable' && (
        <p className="route-card__detail">
          Peak {Math.round(route.congestion.peak)} people/hr
        </p>
      )}
    </article>
  )
}
```

- [ ] **Step 3: Draw the returned polylines**

Write `frontend/src/components/MapView.tsx`:

```tsx
import { MapContainer, TileLayer, Polyline, Popup } from 'react-leaflet'
import type { ApiRoute, LatLng } from '../api/types'
import './MapView.css'

const MELBOURNE_CBD: LatLng = [-37.8136, 144.9631]

const COLORS: Record<ApiRoute['type'], string> = {
  quiet: '#5EE39C',
  direct: '#C22A2A',
}

export default function MapView({
  routes = [],
  center = MELBOURNE_CBD,
}: {
  routes?: ApiRoute[]
  center?: LatLng
}) {
  return (
    <div className="hw-map">
      <MapContainer center={center} zoom={14} scrollWheelZoom className="hw-map__container">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {routes.map((route) => (
          <Polyline
            key={route.id}
            positions={route.path}
            pathOptions={{ color: COLORS[route.type], weight: 5, opacity: 0.85 }}
          >
            <Popup>
              {route.type === 'quiet' ? 'Quiet Route' : 'Fastest Route'} ·{' '}
              {route.duration_min} min
            </Popup>
          </Polyline>
        ))}
      </MapContainer>
    </div>
  )
}
```

- [ ] **Step 4: Verify it type-checks and builds**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: no errors, build succeeds

- [ ] **Step 5: Verify end to end by hand**

Start the backend (`cd backend && uvicorn app.main:app --port 8000`) and the frontend
(`cd frontend && npm run dev`), then open `http://localhost:5173/explore`:

1. Both dropdowns list CBD landmarks.
2. Choosing an origin and destination draws polylines and lists route cards.
3. Each card shows a Low or High sensory badge.
4. Switching the crowd density pill re-fetches and can change the drawn route (US 1.3 AC5).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/RouteCompare.tsx frontend/src/pages/RouteCompare.css frontend/src/components/RouteCard.tsx frontend/src/components/MapView.tsx
git commit -m "feat: wire route comparison page to the live API"
```

---

### Task 15: Retire the broken graph loader and document setup

**Files:**
- Modify: `scripts/data_loader.py:113-173` (graph sections), `scripts/data_loader.py:14-20` (DB config)
- Create: `README.md`

**Interfaces:**
- Consumes: `scripts/build_graph.py`.
- Produces: no new code interfaces.

- [ ] **Step 1: Make the loader read the password from the environment**

In `scripts/data_loader.py`, replace the `DB_CONFIG` block:

```python
import os

DB_CONFIG = {
    'host': os.environ.get('HUSHWAY_DB_HOST', 'localhost'),
    'database': os.environ.get('HUSHWAY_DB_NAME', 'postgres'),
    'user': os.environ.get('HUSHWAY_DB_USER', 'postgres'),
    'password': os.environ.get('HUSHWAY_DB_PASSWORD', ''),
    'port': int(os.environ.get('HUSHWAY_DB_PORT', '5432')),
}
```

- [ ] **Step 2: Remove the graph sections**

Delete LOAD 4 and LOAD 5 entirely (from `# LOAD 4: GRAPH_NODE (from OSM features)` through
the `ENABLE TRIGGER ALL` commit), and replace with:

```python
# Graph loading moved to scripts/build_graph.py.
# The OSM CSV has no coordinates or way-to-node membership, so it cannot produce a
# routable graph. build_graph.py derives the graph from sensor locations instead.
print("\n[4] Graph: run `python scripts/build_graph.py` (see docs/superpowers/specs/)")
```

Then fix the closing summary, which references removed variables:

```python
print("\nTables populated:")
print(f"   sensor_locations: 134 records")
print(f"   pedestrian_counts_hourly: {total:,} records")
print(f"   pedestrian_counts_fast_hour: {len(df_fast):,} records")
```

- [ ] **Step 3: Verify the loader still parses**

Run: `python -c "import ast; ast.parse(open('scripts/data_loader.py').read()); print('ok')"`
Expected: `ok`

- [ ] **Step 4: Write the README**

Create `README.md` at the repository root:

````markdown
# HushWay

Sensory-aware wayfinding for the Melbourne CBD — walking routes optimised for calm
rather than speed, using City of Melbourne pedestrian-count data.

## Prerequisites

- Node.js 20 LTS or newer
- Python 3.12
- PostgreSQL 14+ running on `localhost:5432`

## Setup

```bash
git clone https://github.com/crag0006/hushway.git
cd hushway
export HUSHWAY_DB_PASSWORD=<your postgres password>
```

### 1. Database

Place the cleaned CSVs in `scripts/clean_data/` (they are gitignored — ask the team
for a copy), then:

```bash
psql -U postgres -d postgres -f db/schema.sql
python scripts/data_loader.py         # sensors + pedestrian counts
psql -U postgres -d postgres -f db/epic1_graph.sql
python scripts/build_graph.py         # routable graph, landmarks, hourly profile
```

### 2. Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Check it: <http://localhost:8000/api/health> should report 134 graph nodes.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Opens <http://localhost:5173>. The route planner is at `/explore`.

## Tests

```bash
cd backend && python -m pytest        # unit tests need no database; integration tests do
cd frontend && npx tsc --noEmit
```

## Project layout

| Path | Contents |
| --- | --- |
| `backend/` | FastAPI service: graph, scoring, planner, API |
| `frontend/` | React + TypeScript + Vite app |
| `db/` | Schema and EPIC-1 migration |
| `scripts/` | Data loader and graph builder |
| `docs/superpowers/` | Design specs and implementation plans |

## Notes

- Never commit `node_modules/` or the data CSVs; both are gitignored.
- The routing graph is derived from the 134 sensor locations, so routes are drawn
  sensor-to-sensor rather than along footpaths. See
  `docs/superpowers/specs/2026-08-10-epic1-backend-design.md` for why, and for the
  `GraphProvider` seam that allows real OpenStreetMap geometry to be swapped in.
````

- [ ] **Step 5: Run the full suite**

Run: `cd backend && python -m pytest -v`
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add scripts/data_loader.py README.md
git commit -m "refactor: retire broken graph loader, document project setup"
```

---

## Self-Review

**Spec coverage:** All seven design decisions map to tasks — D1/D2 to Tasks 3 and 4, D3 to
Tasks 2 and 5, D4 to Tasks 1 and 6, D5 to Tasks 3 and 9, D6 to Tasks 6 and 8, D7 to Task 6.
All 13 acceptance criteria have named tests in Tasks 6, 8, 10, 12 and 14. Frontend wiring
covers every file listed in the spec's table except `WarningBanner.tsx`, which needs no
change — it already accepts `title` and `message` props and is fed live warnings in Task 14.

**Placeholder scan:** No TBD, TODO, or "handle errors appropriately" steps. Every code step
contains complete, runnable code.

**Type consistency:** `Node`/`Edge` field names (`node_id`, `lat`, `lon`, `sensor_id`,
`from_id`, `to_id`, `length_m`) are consistent from Task 4 onward. `CountProfile.count_for`
and `.has_data` match between Tasks 5, 6 and 7. `RouteScore` fields (`level`, `score`,
`peak_count`, `mean_count`, `coverage`) match their use in Tasks 8 and 10. `PlannedRoute`
fields (`route_id`, `kind`, `path`, `distance_m`, `duration_min`, `score`) match Task 10's
response mapping. `Density` and `DENSITY_THRESHOLDS` match between Tasks 12 and 13.
The backend's `type` field (`quiet`/`direct`) matches the frontend `ApiRoute['type']` union
and the `TITLES`/`COLORS` maps in Task 14.

## Acceptance criteria traceability

| AC | Test | Task |
| --- | --- | --- |
| 1.1 AC1 | `test_routes_returns_selectable_routes`, `test_returns_routes_between_two_landmarks` | 8, 10 |
| 1.1 AC2 | `test_every_route_carries_sensory_level` + `SensoryBadge` | 6, 13 |
| 1.1 AC3 | `test_classify_low_below_threshold`, `test_classify_high_at_threshold` | 6 |
| 1.1 AC4 | `test_uncovered_route_reports_unavailable`, `test_uncovered_route_raises_unavailable_warning` | 6, 8 |
| 1.2 AC1 | `test_corridor_flagged_at_threshold` | 6 |
| 1.2 AC2 | `test_alternative_avoids_congested_edge` | 8 |
| 1.2 AC3 | `test_no_lower_congestion_route_warning` | 8 |
| 1.2 AC4 | `test_alternative_peak_strictly_lower` | 8 |
| 1.3 AC1 | `test_threshold_param_applied`, `useSensitivity` persistence | 10, 12 |
| 1.3 AC2 | `test_exceeds_preferred_threshold_warning` | 8 |
| 1.3 AC3 | `test_offers_lower_congestion_alternative` | 8 |
| 1.3 AC4 | `test_no_lower_congestion_route_warning` | 8 |
| 1.3 AC5 | `test_route_changes_with_threshold` + `useRoute` dependency on threshold | 8, 12 |
