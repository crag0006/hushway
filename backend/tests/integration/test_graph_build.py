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
