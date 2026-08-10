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
