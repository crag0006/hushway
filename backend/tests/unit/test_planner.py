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

# Trap graph: the cheapest first hop (1->2, 10m) leads to a very expensive
# second hop (2->4, 1000m). A greedy walk takes it; Dijkstra must not.
TRAP_NODES = [
    Node(node_id=1, lat=-37.8180, lon=144.9600, sensor_id=1),
    Node(node_id=2, lat=-37.8170, lon=144.9650, sensor_id=2),
    Node(node_id=3, lat=-37.8190, lon=144.9650, sensor_id=3),
    Node(node_id=4, lat=-37.8180, lon=144.9700, sensor_id=4),
]
TRAP_EDGES = [
    Edge(from_id=1, to_id=2, length_m=10.0),
    Edge(from_id=2, to_id=4, length_m=1000.0),
    Edge(from_id=1, to_id=3, length_m=100.0),
    Edge(from_id=3, to_id=4, length_m=100.0),
]
TRAP = SensorGraphProvider(TRAP_NODES, TRAP_EDGES)


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


def test_penalty_is_capped_for_extreme_counts():
    # ratio would be 5000/500 = 10, but PENALTY_CAP clamps it to 4.0,
    # so the multiplier is 1 + 2.0 * 4.0 = 9.0 rather than 1 + 2.0 * 10.
    extreme = CountProfile({1: 5000, 2: 5000, 3: 50, 4: 50})
    cost = sensory_cost(GRAPH, extreme, 500)
    assert cost(1, 2, 100.0) == 900.0


def test_returns_the_optimal_path_not_the_greedy_one():
    # Greedy takes 1->2 first and ends up with 1010m; the optimum is 200m.
    path = shortest_path(TRAP, 1, 4, distance_cost(TRAP))
    assert path == [1, 3, 4]
    assert path_length_m(TRAP, path) == 200.0
