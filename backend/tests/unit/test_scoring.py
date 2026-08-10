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
