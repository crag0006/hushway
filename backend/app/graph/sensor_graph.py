"""Graph backed by sensor locations, loaded from graph_node / graph_edge."""

import math
from functools import lru_cache

from app.db import get_cursor
from app.graph.base import Edge, Node


def _squared_distance(
    a_lat: float, a_lon: float, b_lat: float, b_lon: float
) -> float:
    """Cheap planar comparison, adequate for nearest-node snapping in the CBD."""
    dlat = a_lat - b_lat
    dlon = (a_lon - b_lon) * math.cos(math.radians(a_lat))
    return dlat * dlat + dlon * dlon


class SensorGraphProvider:
    """In-memory adjacency over sensor nodes."""

    def __init__(self, nodes: list[Node], edges: list[Edge]) -> None:
        self._nodes = {n.node_id: n for n in nodes}
        self._edges = edges
        self._adj: dict[int, list[tuple[int, float]]] = {
            n.node_id: [] for n in nodes
        }
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
        if not self._nodes:
            raise ValueError(
                "Graph has no nodes. Run scripts/build_graph.py to populate "
                "graph_node and graph_edge."
            )
        return min(
            self._nodes.values(),
            key=lambda n: _squared_distance(lat, lon, n.lat, n.lon),
        )


@lru_cache
def load_graph() -> SensorGraphProvider:
    """Load the graph from the database once per process."""
    with get_cursor() as cur:
        cur.execute(
            "SELECT node_id, latitude, longitude, sensor_id FROM graph_node"
        )
        nodes = [
            Node(
                node_id=r["node_id"],
                lat=r["latitude"],
                lon=r["longitude"],
                sensor_id=r["sensor_id"],
            )
            for r in cur.fetchall()
        ]
        cur.execute(
            "SELECT from_node_id, to_node_id, length_meters FROM graph_edge"
        )
        edges = [
            Edge(
                from_id=r["from_node_id"],
                to_id=r["to_node_id"],
                length_m=r["length_meters"],
            )
            for r in cur.fetchall()
        ]
    return SensorGraphProvider(nodes, edges)
