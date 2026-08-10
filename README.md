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
echo "HUSHWAY_DB_PASSWORD=<your postgres password>" > .env
```

Every script and the API read the database password from `HUSHWAY_DB_PASSWORD`. Nothing is
hardcoded. `.env` is gitignored and `scripts/dev.sh` loads it automatically; if you prefer,
`export HUSHWAY_DB_PASSWORD='...'` in your shell works just as well.

**Do not edit the password into `scripts/dev.sh`** — that file is tracked by git, so the
password would be committed. It also would not work: a plain shell variable is not passed
to child processes, so the API would still fail to reach Postgres.

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

### 2. Install dependencies

```bash
pip install -r requirements.txt     # Python: API, scripts and tests
cd frontend && npm install && cd .. # Frontend
```

There is one `requirements.txt`, at the repository root, covering the API and the data
scripts together.

### 3. Run the app

One command starts both servers:

```bash
./scripts/dev.sh
```

```
Starting backend on :8000 ...
  {"status":"ok","graph_nodes":134,"graph_edges":345,"sensors_with_data":100}
Starting frontend on :5173 ...

  HushWay is running.

    App             http://localhost:5173
    Route planner   http://localhost:5173/explore
    API docs        http://localhost:8000/docs
```

Press **Ctrl-C** to stop both. Logs are written to `logs/`.

If a previous run is still holding the ports, `./scripts/dev.sh --restart` stops it first.

The script checks your setup before starting and tells you exactly what to fix if the
database password is unset, dependencies are missing, a port is already taken, or the
routing graph is empty.

<details>
<summary>Running the two servers separately</summary>

```bash
cd backend && uvicorn app.main:app --reload --port 8000   # terminal 1
cd frontend && npm run dev                                # terminal 2
```
</details>

**Overrides** — `HUSHWAY_BACKEND_PORT`, `HUSHWAY_FRONTEND_PORT`, and `HUSHWAY_PYTHON` (set
this if `python3` is not the interpreter holding your dependencies, e.g.
`HUSHWAY_PYTHON=/opt/anaconda3/bin/python`).

## Walkthrough

**One thing to know first:** the browser always scores routes for **the current day and
hour**. The same trip looks different at Saturday lunchtime and Tuesday midnight — that is
the product working, not a bug. Each scenario below therefore gives a `curl` command with
the time pinned, so you can reproduce the exact figures whenever you read this.

`dow` is 0 = Sunday through 6 = Saturday.

### Scenario 1 — The calm route is not the fast route

Parliament Station to Federation Square, Saturday 1pm, with crowds tolerated
(threshold 1000):

```bash
curl -s "http://localhost:8000/api/routes?origin_id=4&destination_id=5&dow=6&hour=13&threshold=1000"
```

| Route | Time | Distance | Badge | Busiest segment |
| --- | --- | --- | --- | --- |
| **Quiet Route** (recommended, green) | 19 min | 1.5 km | **Low Sensory** | 334 people/hr |
| **Fastest Route** (red) | 17 min | 1.3 km | **High Sensory** | 2,783 people/hr |

Two extra minutes of walking avoids roughly **eight times** the foot traffic. That is the
whole product in one comparison.

In the browser:

1. Run `./scripts/dev.sh` and open <http://localhost:5173/explore>.
2. Click the **High** crowd-density pill.
3. Choose **Parliament Station** as the origin and **Federation Square** as the
   destination.
4. Two cards appear in the sidebar and two lines are drawn on the map — green for the
   quiet route, red for the fastest. Click either line to identify it.

Your numbers will be lower than the table late at night and higher at peak hour, but the
quiet route should stay below the fast one.

### Scenario 2 — It tells you when it cannot help

A tool for sensory-sensitive travel is only useful if it admits what it does not know.
Same trip, same time, but now you want to avoid anything above 250 people/hr:

```bash
curl -s "http://localhost:8000/api/routes?origin_id=4&destination_id=5&dow=6&hour=13&threshold=250"
```

Both routes now come back **High Sensory** — at this stricter preference even the quiet
route's 334 people/hr is too busy for you — along with two warnings:

- *"No lower-congestion route is currently available"*
- *"This route exceeds your preferred crowd level"*

It has not invented a calmer path that does not exist. It shows the best route it found and
says plainly that it falls short of what you asked for.

In the browser, click the **Low** pill on the same trip. The app re-plans immediately and
the badges update. Whether the warnings appear depends on how busy the CBD actually is
right now: at a quiet hour the recommended route may genuinely sit under 250 people/hr, in
which case no warning is correct. Use the `curl` command above to see the warning path on
demand.

Reload the page afterwards — your crowd preference is still selected. It persists between
visits.

### What "unavailable" means

Some routes are badged **"Sensory information unavailable"**. Only 100 of the 134 sensors
report data, so when less than half a route's length is covered, HushWay says so instead of
guessing. An unmeasured route is also never offered as a "less congested" alternative — an
unknown route is not a quieter one.

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
| `docs/` | design spec: why the graph, thresholds and seams are what they are |

## Troubleshooting

**The origin and destination menus are empty.** The frontend could not load places from the
API. The page now says so directly, with the underlying error. Check that the backend is up:

```bash
curl -s http://localhost:8000/api/health
```

`{"status":"ok","graph_nodes":134,...}` is healthy. `"status":"degraded..."` means the API
is running but cannot query the database — look at `logs/backend.log`. `graph_nodes: 0`
means the graph was never built; run `python scripts/build_graph.py`.

**`fe_sendauth: no password supplied` in `logs/backend.log`.** The API did not receive
`HUSHWAY_DB_PASSWORD`. Put it in `.env`, or `export` it — assigning it without `export`
leaves it invisible to child processes.

**`port 8000 is already in use`** (or 5173). A previous run is still going. The script
names the process holding the port; if it is an earlier HushWay run, restart cleanly:

```bash
./scripts/dev.sh --restart
```

If it is something else, stop it yourself or move ports:
`HUSHWAY_BACKEND_PORT=8001 ./scripts/dev.sh`

**Routes fail while places load.** The graph tables are empty or stale. Re-run
`python scripts/build_graph.py`, then restart the API — the graph is cached in-process.

## Notes and known limitations

- **Routes are drawn sensor-to-sensor, not along footpaths.** The routable graph is built
  from the 134 pedestrian sensors because the OSM export in `clean_data/` contains no
  coordinates or way-to-node membership. Lines can therefore cut across blocks. The
  `GraphProvider` interface in `backend/app/graph/base.py` exists so real OpenStreetMap
  geometry can be swapped in without touching the planner, scoring or API. See
  `docs/2026-08-10-epic1-backend-design.md`.
- **Restart the API after re-running `build_graph.py`.** The graph is cached in-process for
  speed, so a running server keeps serving the old one.
- **Never commit `node_modules/` or the data CSVs.** Both are gitignored. `node_modules`
  was committed once before and broke every clone, because symlinks do not survive.
- `/quietplace`, `/community` and `/resources` are EPIC-2 and later; they still render mock
  data from `src/mockData.ts`.
- Sign-in and registration are presentational only — there is no authentication yet.
