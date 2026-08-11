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


def test_low_counts_produce_no_exceeds_warning():
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
    # Counts of 0 are real measurements ("nobody there"), not missing data,
    # so coverage stays complete.
    profile = CountProfile({1: 0, 2: 200, 3: 0, 4: 0})
    tolerant = plan_routes(GRAPH, profile, 1, 4, 1000, 0.5, 1.35)
    strict = plan_routes(GRAPH, profile, 1, 4, 250, 0.5, 1.35)
    tolerant_quiet = next(r for r in tolerant.routes if r.kind == "quiet")
    strict_quiet = next(r for r in strict.routes if r.kind == "quiet")
    assert tolerant_quiet.path == [1, 2, 4]
    assert strict_quiet.path == [1, 3, 4]


def test_duration_uses_walking_speed():
    # Uniform counts mean the quiet and direct paths coincide, so dedup
    # returns a single route. 200 m at 1.35 m/s is 148 s -> 3 minutes.
    profile = CountProfile({1: 50, 2: 50, 3: 50, 4: 50})
    result = plan_routes(GRAPH, profile, 1, 4, 500, 0.5, 1.35)
    assert len(result.routes) == 1
    assert result.routes[0].path == [1, 2, 4]
    assert result.routes[0].duration_min == 3


# Detour threading two consecutive unmeasured nodes: those edges are neither
# congested (edge_count returns None) nor covered (score_path needs both
# endpoints), so the candidate's peak is forced to 0.0. The detour is long
# enough that the first sensory pass still picks the short congested route,
# so the avoidance replan is the code path under test.
GAP_NODES = [
    Node(node_id=1, lat=-37.8180, lon=144.9600, sensor_id=1),
    Node(node_id=2, lat=-37.8170, lon=144.9650, sensor_id=2),
    Node(node_id=3, lat=-37.8190, lon=144.9640, sensor_id=3),
    Node(node_id=5, lat=-37.8190, lon=144.9670, sensor_id=5),
    Node(node_id=4, lat=-37.8180, lon=144.9700, sensor_id=4),
]
GAP_EDGES = [
    Edge(from_id=1, to_id=2, length_m=100.0),
    Edge(from_id=2, to_id=4, length_m=100.0),
    Edge(from_id=1, to_id=3, length_m=600.0),
    Edge(from_id=3, to_id=5, length_m=600.0),
    Edge(from_id=5, to_id=4, length_m=600.0),
]
GAP_GRAPH = SensorGraphProvider(GAP_NODES, GAP_EDGES)


def test_unmeasured_detour_is_not_offered_as_lower_congestion():
    # US 1.2 AC4 requires the alternative be lower "based on the available
    # pedestrian data". A route with no data is unknown, not quieter, so it
    # must not replace a measured route just because its peak reads 0.0.
    profile = CountProfile({1: 100, 2: 2000, 4: 100})
    result = plan_routes(GAP_GRAPH, profile, 1, 4, 500, 0.5, 1.35)
    quiet = next(r for r in result.routes if r.kind == "quiet")
    assert quiet.path == [1, 2, 4], "must keep the measured route"
    assert quiet.score.level != "unavailable"
    assert WARN_NO_ALTERNATIVE in codes(result)
