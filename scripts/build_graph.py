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

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(_HERE), "backend"))

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
