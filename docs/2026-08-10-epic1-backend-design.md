# EPIC-1 Backend — Sensory-Aware Route Planning

**Date:** 2026-08-10
**Status:** Approved (design)
**Scope:** Epic 1 — User Stories 1.1, 1.2, 1.3 (13 acceptance criteria)
**Source of truth:** `Epics and User Stories.pages`

## Purpose

Stand up a backend service that makes every EPIC-1 acceptance criterion work against
real data, and wire the existing React frontend to it, so HushWay runs end to end:
a user enters an origin and destination in the Melbourne CBD, selects a crowd
preference, and receives routes labelled Low or High sensory with a less-congested
alternative where one exists.

## Findings that shape this design

Investigated 2026-08-10 against the live database and `scripts/clean_data/`.

**Usable as-is:**

| Asset | State |
| --- | --- |
| `sensor_locations` | 134 rows, real CBD coordinates, all status `A` |
| `pedestrian_counts_hourly` | 1,521,029 rows, 2024-08-03 → 2026-08-02 |
| Frontend UI | Pages, components and styles built; `api/` and `hooks/` are empty placeholders |

**Not usable — the reason this design exists:**

| Check | Result |
| --- | --- |
| `graph_node` rows with coordinates | 0 of 14,309 (all NULL) |
| `graph_edge` endpoints resolving to a node | 0 of 14,474 |
| `graph_edge.length_meters` / `nearest_sensor_id` | 0 populated |
| `osm_features_clean.csv` columns | `osm_sequence_id, type, osm_id, name` — no geometry |
| Named nodes in that CSV | Metro railway stations (Ashburton, Burwood, Westgarth…), not CBD intersections |

The source CSV never contained coordinates or way→node membership, so the graph cannot
be repaired from data on disk. `scripts/data_loader.py` compounds this: line 126 inserts
`None, None` for every node's lat/lon, and line 156 fabricates edges as
`from=osm_id, to=osm_id+1`, which connect nothing.

**Also relevant:**

- Only **100 of 134 sensors** have any count data. 34 nodes are genuinely blank, which
  exercises US 1.1 AC4 with real data rather than a contrived fixture.
- `pedestrian_counts_fast_hour` spans only 2026-08-02 23:55 → 2026-08-03 09:55. Out of
  scope: this project uses static historical data, no real-time feed.

## Decisions

### D1 — Graph built from sensor locations, behind a swappable interface

Nodes are the 134 sensors, which already carry real coordinates. Edges join each sensor
to its **4 nearest neighbours** by haversine distance.

Measured: k=4 produces a **fully connected** graph of 345 edges, median length 181 m,
with zero bridging required. (k=3 leaves 3 components; a pure radius graph leaves 4–5
outlier sensors stranded even at 1 km.) Component-bridging via nearest-pair linking is
retained as a safety net should the sensor set change.

Rejected: geocoding the CSV's node names. It recovers points but never edges — way→node
membership is what makes a graph traversable — and the named entities are suburban
railway stations, not intersections.

Deferred: fetching real CBD footpaths from OpenStreetMap. Better map fidelity, but adds
a network-dependent ingest step. `GraphProvider` (D2) makes this a later swap of one
module.

**Consequence to accept:** routes render as straight lines between sensors and can cut
across blocks. Acceptable for demonstrating the acceptance criteria; the OSM swap is the
fix when visual fidelity matters.

### D2 — `GraphProvider` interface as the swap point

```python
class GraphProvider(Protocol):
    def nodes(self) -> list[Node]: ...
    def edges(self) -> list[Edge]: ...
    def snap(self, lat: float, lon: float) -> Node: ...
```

`SensorGraphProvider` implements it now; `OsmGraphProvider` can later. Planner, scoring
and API contract do not change across that swap.

### D3 — Precomputed hourly profile

A `sensor_hourly_profile` table holds average count per sensor per weekday-hour:
100 sensors × 7 days × 24 hours ≈ 16,800 rows, built once from the 1.52M-row table.
Requests never scan the large table.

### D4 — Thresholds derived from the data

The epics document specifies "the defined threshold" without a value. Derived from the
observed distribution of `total_of_directions` (p25=39, p50=161, p60=247, p75=476,
p90=1031):

| Preference | Threshold (per hour) | Percentile |
| --- | --- | --- |
| Low — "I want quiet" | 250 | ~p60 |
| Mid — default | 500 | ~p75 |
| High — "crowds are fine" | 1000 | ~p90 |

**500/hr is the default threshold** for the Low/High sensory label. Sanity check: median
count at Tuesday 17:00 is 509, so peak hour splits the CBD roughly in half — the labels
carry information. The three levels map to SearchPanel's existing density pills.

### D5 — Curated CBD landmarks for origin/destination

With geocoding excluded, text like "Flinders St Station" cannot resolve to coordinates.
A `cbd_landmark` seed table of ~25 hand-authored CBD places (station, State Library,
Federation Square, QV, Melbourne Central, Southern Cross…), each snapped to its nearest
graph node, backs `GET /api/places`. This is **new authored data**, not derived from the
council datasets.

### D6 — Route congestion metrics

Each route reports `peak` (maximum edge count) and `mean` (length-weighted average).
Comparisons for US 1.2 AC4 use **peak** as primary, `mean` as tie-break: sensory overload
is driven by worst exposure, not average.

### D7 — Coverage rule for missing data

A route reports `sensory.level = "unavailable"` when **under 50% of its length** has
sensor coverage. Above that, the level is computed from covered segments and `coverage`
is returned so the UI can qualify it.

## Architecture

```
backend/
├── requirements.txt
├── app/
│   ├── main.py               FastAPI app, CORS for http://localhost:5173
│   ├── config.py             DB settings from environment
│   ├── db.py                 connection pool
│   ├── schemas.py            pydantic response models
│   ├── graph/
│   │   ├── base.py           GraphProvider protocol + Node/Edge
│   │   └── sensor_graph.py   kNN implementation, loads from graph_node/graph_edge
│   ├── services/
│   │   ├── profile.py        hourly count lookup
│   │   ├── scoring.py        sensory level, thresholds, coverage
│   │   └── planner.py        dijkstra, avoidance, alternative comparison
│   └── routers/
│       ├── health.py
│       ├── places.py
│       └── routes.py
└── tests/
    ├── unit/                 fixture graph, no DB
    └── integration/          against live DB
db/
└── epic1_graph.sql           graph rebuild, cbd_landmark, sensor_hourly_profile
scripts/
└── build_graph.py            populates graph + profile from sensors and counts
```

Stack: FastAPI, uvicorn, psycopg2, networkx, pydantic. Only FastAPI is not already
present in the Anaconda environment.

### Data flow

```
GET /api/routes
  → resolve origin/destination landmarks → snap to graph nodes
  → load graph (cached) + hourly profile for (dow, hour)
  → plan direct route      : dijkstra on distance
  → plan quiet route       : dijkstra on distance × (1 + penalty(count/threshold))
  → if quiet route ≥ threshold anywhere:
        replan with congested edges excluded
        keep only if peak strictly lower than original
  → score each route: level, peak, mean, coverage
  → collect warnings
  → respond
```

### Warning codes

| Code | Raised when | Serves |
| --- | --- | --- |
| `SENSORY_DATA_UNAVAILABLE` | route coverage < 50% | US 1.1 AC4 |
| `NO_LOWER_CONGESTION_ROUTE` | no alternative with strictly lower peak | US 1.2 AC3, US 1.3 AC4 |
| `EXCEEDS_PREFERRED_THRESHOLD` | selected route peak ≥ user threshold | US 1.3 AC2 |

## API

```
GET /api/health
    → { status, graph_nodes, graph_edges, sensors_with_data }

GET /api/places?q=<substring>
    → { places: [ { id, name, kind, lat, lng } ] }

GET /api/routes?origin_id=&destination_id=&threshold=&dow=&hour=
    → { routes: [ { id, type: "quiet"|"direct", path: [[lat,lng]],
                    distance_m, duration_min,
                    sensory:    { level: "low"|"high"|"unavailable",
                                  score, peak_count, coverage },
                    congestion: { peak, mean } } ],
        warnings: [ { code, message } ],
        threshold_used }
```

`dow` and `hour` default to the current weekday and hour. Origin or destination outside
the CBD bounding box returns HTTP 422 with a structured error (US 1.1 AC1, valid input).

## Frontend wiring

| File | Change |
| --- | --- |
| `src/api/types.ts` | TypeScript mirrors of the response models |
| `src/api/client.ts` | typed `fetch` wrapper, base URL from `VITE_API_URL` |
| `src/hooks/useRoute.ts` | fetch routes; re-fetch when threshold changes (US 1.3 AC5) |
| `src/hooks/useSensitivity.ts` | persist preference to `localStorage` (US 1.3 AC1) |
| `src/components/SensoryBadge.tsx` | Low / High / Unavailable pill |
| `src/components/SearchPanel.tsx` | landmark autocomplete; density pills drive threshold |
| `src/pages/RouteCompare.tsx` | render real routes; drop `mockData` import |
| `src/components/MapView.tsx` | draw returned polylines |
| `src/components/WarningBanner.tsx` | render warnings from the response |

`mockData.ts` stays for pages outside EPIC-1 scope (`RefugeMap`, `Home`).

## Testing and AC traceability

Every acceptance criterion maps to a named test.

| AC | Requirement | Test |
| --- | --- | --- |
| 1.1 AC1 | Display selectable route for valid CBD start/destination | `test_routes_returns_selectable_routes` |
| 1.1 AC2 | Each route shows a Low/High indicator | `test_every_route_carries_sensory_level` |
| 1.1 AC3 | Below threshold → Low; at or above → High | `test_classify_low_below_threshold`, `test_classify_high_at_threshold` |
| 1.1 AC4 | Missing counts → "Sensory information unavailable" | `test_uncovered_route_reports_unavailable` |
| 1.2 AC1 | Corridor at/above threshold flagged congested | `test_corridor_flagged_at_threshold` |
| 1.2 AC2 | Alternate avoids the congested area when one exists | `test_alternative_avoids_congested_edge` |
| 1.2 AC3 | All routes congested → warning | `test_no_lower_congestion_route_warning` |
| 1.2 AC4 | Alternative has strictly lower congestion | `test_alternative_peak_strictly_lower` |
| 1.3 AC1 | Preferred threshold saved and applied | `test_threshold_param_applied`, `test_sensitivity_persisted` |
| 1.3 AC2 | Route exceeding preference reports it | `test_exceeds_preferred_threshold_warning` |
| 1.3 AC3 | At least one lower-congestion alternative offered | `test_offers_lower_congestion_alternative` |
| 1.3 AC4 | No alternative → warning | `test_no_alternative_warning` |
| 1.3 AC5 | Route updates when threshold changes | `test_route_changes_with_threshold` |

Unit tests run against a small fixture graph with hand-set counts, so both sides of every
threshold and every warning path are deterministic. Integration tests assert graph
connectivity and profile correctness against the live database.

## Setup impact

New steps for teammates, to be added to the README:

```bash
psql -U postgres -f db/epic1_graph.sql     # graph tables, landmarks, profile
python scripts/build_graph.py              # populate graph + profile
cd backend && pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

`build_graph.py` **overwrites** `graph_node` and `graph_edge`, discarding the 28,783 rows
of unusable data. `data_loader.py`'s graph section (loads 4 and 5) becomes obsolete and
will defer to `build_graph.py` so a re-run cannot reinstate the broken graph.

The database password currently hardcoded at `data_loader.py:18` moves to the environment
(`HUSHWAY_DB_*`), with a documented default for local development.

## Out of scope

- EPIC-2: refuge locations, predictive alerts, `/quietplace` data.
- Real-time pedestrian feeds. Static historical data only, by decision.
- Authentication. `SignIn`/`SignUp` pages stay presentational.
- Real OSM street geometry — deferred behind `GraphProvider` (D1, D2).

## Risks

| Risk | Mitigation |
| --- | --- |
| Straight-line routes look wrong on the map | Accepted for now; OSM swap is one module (D2) |
| 34 sensors without counts distort quiet routing | Uncovered edges take a neutral cost; coverage surfaced per route (D7) |
| Curated landmark list is authored, not sourced | Small, documented, replaceable by a real dataset |
| Threshold values are judgement calls | Derived from measured percentiles and documented (D4); configurable per request |
