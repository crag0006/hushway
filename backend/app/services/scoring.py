"""Sensory classification and route-level congestion metrics."""

from dataclasses import dataclass

LEVEL_LOW = "low"
LEVEL_HIGH = "high"
LEVEL_UNAVAILABLE = "unavailable"


def classify(count: float, threshold: int) -> str:
    """US 1.1 AC3: below the threshold is Low, at or above it is High."""
    return LEVEL_HIGH if count >= threshold else LEVEL_LOW


def is_congested(count: float, threshold: int) -> bool:
    """US 1.2 AC1: a corridor is congested at or above the threshold."""
    return count >= threshold


def edge_count(profile, node_a, node_b):
    """Average count across an edge's endpoints, or None when neither reports.

    Deliberately tolerant: a single reporting endpoint still yields a number,
    because congestion avoidance should act on any evidence it has. Route-level
    scoring is stricter — `score_path` requires BOTH endpoints before counting
    an edge as covered, since labelling a route Low or High from half the data
    overstates confidence. The two rules serve different purposes, so an edge
    can be treated as congested while the route containing it reports
    "unavailable".
    """
    values = [
        v
        for v in (profile.count_for(node_a.sensor_id), profile.count_for(node_b.sensor_id))
        if v is not None
    ]
    if not values:
        return None
    return sum(values) / len(values)


@dataclass(frozen=True)
class RouteScore:
    level: str
    score: float
    peak_count: float
    mean_count: float
    coverage: float


def score_path(
    provider, profile, path: list[int], threshold: int, coverage_min: float
) -> RouteScore:
    """Score a node path: peak and mean counts, coverage, and Low/High/unavailable."""
    total_length = 0.0
    covered_length = 0.0
    weighted_sum = 0.0
    peak = 0.0

    for from_id, to_id in zip(path, path[1:]):
        node_a, node_b = provider.node(from_id), provider.node(to_id)
        length = dict(provider.neighbours(from_id))[to_id]
        total_length += length

        # Only count edge as covered if both endpoints have data
        if not (
            profile.has_data(node_a.sensor_id) and
            profile.has_data(node_b.sensor_id)
        ):
            continue
        count = edge_count(profile, node_a, node_b)
        covered_length += length
        weighted_sum += count * length
        peak = max(peak, count)

    coverage = (covered_length / total_length) if total_length else 0.0
    mean = (weighted_sum / covered_length) if covered_length else 0.0

    if coverage < coverage_min:
        return RouteScore(LEVEL_UNAVAILABLE, 0.0, 0.0, 0.0, round(coverage, 3))

    return RouteScore(
        level=classify(peak, threshold),
        score=round(peak / threshold, 3),
        peak_count=round(peak, 1),
        mean_count=round(mean, 1),
        coverage=round(coverage, 3),
    )
