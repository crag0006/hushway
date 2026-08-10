# HushWay

Sensory-aware wayfinding for the Melbourne CBD — walking routes optimised for calm rather
than speed, using City of Melbourne pedestrian-count data.

Enter a start and destination in the CBD, pick how much crowding you can tolerate, and
HushWay returns walking routes labelled **Low** or **High** sensory, with a
less-congested alternative when one genuinely exists.

## Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | 20 LTS or newer | `node -v` to check |
| Python | 3.12 | with `pandas`, `psycopg2`, `networkx` |
| PostgreSQL | 14+ | running on `localhost:5432` |

**`psql` may not be on your PATH.** With the EDB installer on macOS it lives at
`/Library/PostgreSQL/<version>/bin/psql`. Either use the full path or add it first:

```bash
export PATH="/Library/PostgreSQL/18/bin:$PATH"
```

## Setup

```bash
git clone https://github.com/crag0006/hushway.git
cd hushway
export HUSHWAY_DB_PASSWORD='<your postgres password>'
```

Every script and the API read the database password from `HUSHWAY_DB_PASSWORD`. Nothing is
hardcoded, so set it in each shell you use (or add it to your shell profile).

### 1. Database

The cleaned CSVs are gitignored — ask the team for a copy and put them in
`scripts/clean_data/`. Then:

```bash
psql -U postgres -d postgres -f db/schema.sql          # base tables
python scripts/data_loader.py                          # sensors + pedestrian counts
psql -U postgres -d postgres -f db/epic1_graph.sql     # graph, landmarks, profile tables
python scripts/build_graph.py                          # populate them
```

`build_graph.py` should report 134 nodes, 345 edges, 26 landmarks and about 16,700 profile
rows. It is safe to re-run.

### 2. Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Check it: <http://localhost:8000/api/health> should report 134 graph nodes and 100 sensors
with data. Interactive API docs are at <http://localhost:8000/docs>.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Opens <http://localhost:5173>. **The route planner is at `/explore`.** The backend must be
running or the page will report that it cannot reach the route service.

## Tests

```bash
cd backend && python -m pytest        # 45 unit + 18 integration; integration needs the DB
cd frontend && npx tsc --noEmit       # type check
cd frontend && npm run build          # production build
```

## How the sensory scoring works

Pedestrian counts are pre-aggregated per sensor per weekday-hour, so a request for
"Tuesday 5pm" resolves against two years of historical data rather than a live feed.

| Crowd preference | Threshold | Meaning |
| --- | --- | --- |
| Low | 250 /hr | roughly the 60th percentile of observed counts |
| Mid (default) | 500 /hr | roughly the 75th percentile |
| High | 1000 /hr | roughly the 90th percentile |

A route is **High sensory** when its busiest segment is at or above the threshold, and
**Low** below it. Only 100 of the 134 sensors report data, so a route through poorly
instrumented streets reports **"Sensory information unavailable"** rather than guessing —
and an unmeasured detour is never offered as a "less congested" alternative, because an
unknown route is not a quieter one.

## Project layout

| Path | Contents |
| --- | --- |
| `backend/app/graph/` | `GraphProvider` interface and the sensor-backed implementation |
| `backend/app/services/` | scoring, routing, hourly profile |
| `backend/app/routers/` | `/api/health`, `/api/places`, `/api/routes` |
| `frontend/src/api/` | typed client for the backend |
| `frontend/src/hooks/` | `useRoute`, `useSensitivity` |
| `db/` | base schema and the EPIC-1 migration |
| `scripts/` | data loader and graph builder |
| `docs/superpowers/` | design spec and implementation plan |

## Notes and known limitations

- **Routes are drawn sensor-to-sensor, not along footpaths.** The routable graph is built
  from the 134 pedestrian sensors because the OSM export in `clean_data/` contains no
  coordinates or way-to-node membership. Lines can therefore cut across blocks. The
  `GraphProvider` interface in `backend/app/graph/base.py` exists so real OpenStreetMap
  geometry can be swapped in without touching the planner, scoring or API. See
  `docs/superpowers/specs/2026-08-10-epic1-backend-design.md`.
- **Restart the API after re-running `build_graph.py`.** The graph is cached in-process for
  speed, so a running server keeps serving the old one.
- **Never commit `node_modules/` or the data CSVs.** Both are gitignored. `node_modules`
  was committed once before and broke every clone, because symlinks do not survive.
- `/quietplace`, `/community` and `/resources` are EPIC-2 and later; they still render mock
  data from `src/mockData.ts`.
- Sign-in and registration are presentational only — there is no authentication yet.
