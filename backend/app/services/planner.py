"""Dijkstra path finding with pluggable edge cost."""

import heapq
import math
from dataclasses import dataclass

from app.services.scoring import LEVEL_UNAVAILABLE, edge_count, is_congested, score_path

# An edge with no sensor data is treated as half the threshold: not free, not punished.
NEUTRAL_RATIO = 0.5
# How hard congestion is penalised relative to distance.
PENALTY_WEIGHT = 2.0
# Ceiling so one extreme sensor cannot make a corridor infinitely expensive.
PENALTY_CAP = 4.0


def shortest_path(provider, start: int, goal: int, cost_fn):
    """Least-cost node path, or None when the goal is unreachable."""
    if start == goal:
        return [start]

    best = {start: 0.0}
    previous: dict = {}
    queue = [(0.0, start)]
    seen = set()

    while queue:
        cost, node = heapq.heappop(queue)
        if node in seen:
            continue
        seen.add(node)
        if node == goal:
            break
        for neighbour, length in provider.neighbours(node):
            if neighbour in seen:
                continue
            step = cost_fn(node, neighbour, length)
            if step == math.inf:
                continue
            candidate = cost + step
            if candidate < best.get(neighbour, math.inf):
                best[neighbour] = candidate
                previous[neighbour] = node
                heapq.heappush(queue, (candidate, neighbour))

    if goal not in best:
        return None

    path = [goal]
    while path[-1] != start:
        path.append(previous[path[-1]])
    return list(reversed(path))


def distance_cost(provider):
    """Plain distance: the fastest walking route."""

    def cost(from_id, to_id, length_m):
        return length_m

    return cost


def sensory_cost(
    provider, profile, threshold: int, excluded: set | None = None
):
    """Distance inflated by how crowded the edge is.

    Edges in `excluded` are unusable, which is how congestion avoidance is expressed.
    """
    excluded = excluded or set()

    def cost(from_id, to_id, length_m):
        if (min(from_id, to_id), max(from_id, to_id)) in excluded:
            return math.inf
        count = edge_count(
            profile, provider.node(from_id), provider.node(to_id)
        )
        ratio = NEUTRAL_RATIO if count is None else count / threshold
        return length_m * (1 + PENALTY_WEIGHT * min(ratio, PENALTY_CAP))

    return cost


def path_length_m(provider, path: list[int]) -> float:
    """Total walking distance along a node path."""
    total = 0.0
    for from_id, to_id in zip(path, path[1:]):
        total += dict(provider.neighbours(from_id))[to_id]
    return total


WARN_UNAVAILABLE = "SENSORY_DATA_UNAVAILABLE"
WARN_NO_ALTERNATIVE = "NO_LOWER_CONGESTION_ROUTE"
WARN_EXCEEDS = "EXCEEDS_PREFERRED_THRESHOLD"

WARNING_MESSAGES = {
    WARN_UNAVAILABLE: "Sensory information unavailable",
    WARN_NO_ALTERNATIVE: "No lower-congestion route is currently available",
    WARN_EXCEEDS: "This route exceeds your preferred crowd level",
}


@dataclass(frozen=True)
class PlannedRoute:
    route_id: str
    kind: str
    path: list
    distance_m: float
    duration_min: int
    score: object


@dataclass(frozen=True)
class PlanResult:
    routes: list
    warnings: list


def _congested_edges(provider, profile, threshold: int) -> set:
    """Edge keys at or above the threshold (US 1.2 AC1)."""
    congested = set()
    for edge in provider.edges():
        count = edge_count(profile, provider.node(edge.from_id), provider.node(edge.to_id))
        if count is not None and is_congested(count, threshold):
            congested.add((min(edge.from_id, edge.to_id), max(edge.from_id, edge.to_id)))
    return congested


def _build(provider, profile, path, kind, threshold, coverage_min, walk_speed_mps):
    distance = path_length_m(provider, path)
    return PlannedRoute(
        route_id=f"{kind}-{path[0]}-{path[-1]}",
        kind=kind,
        path=path,
        distance_m=round(distance, 1),
        duration_min=max(1, math.ceil(distance / walk_speed_mps / 60)),
        score=score_path(provider, profile, path, threshold, coverage_min),
    )


def plan_routes(provider, profile, start, goal, threshold, coverage_min, walk_speed_mps):
    """Plan a direct route and the least-sensory alternative, with warnings."""
    warnings = []

    direct_path = shortest_path(provider, start, goal, distance_cost(provider))
    if direct_path is None:
        return PlanResult([], [{"code": WARN_NO_ALTERNATIVE,
                                "message": WARNING_MESSAGES[WARN_NO_ALTERNATIVE]}])

    direct = _build(provider, profile, direct_path, "direct", threshold,
                    coverage_min, walk_speed_mps)

    quiet_path = shortest_path(provider, start, goal, sensory_cost(provider, profile, threshold))
    quiet = _build(provider, profile, quiet_path, "quiet", threshold,
                   coverage_min, walk_speed_mps)

    # US 1.2 AC2: if the quiet route is still congested, replan avoiding congested edges.
    if quiet.score.level != LEVEL_UNAVAILABLE and quiet.score.peak_count >= threshold:
        excluded = _congested_edges(provider, profile, threshold)
        avoid_path = shortest_path(
            provider, start, goal, sensory_cost(provider, profile, threshold, excluded)
        )
        replacement = None
        if avoid_path is not None:
            candidate = _build(provider, profile, avoid_path, "quiet", threshold,
                               coverage_min, walk_speed_mps)
            # US 1.2 AC4: only offer it if congestion is genuinely lower.
            if candidate.score.peak_count < quiet.score.peak_count:
                replacement = candidate
        if replacement is not None:
            quiet = replacement
        else:
            warnings.append({"code": WARN_NO_ALTERNATIVE,
                             "message": WARNING_MESSAGES[WARN_NO_ALTERNATIVE]})

    # US 1.3 AC2: tell the user when the recommended route still exceeds their preference.
    if quiet.score.level != LEVEL_UNAVAILABLE and quiet.score.peak_count >= threshold:
        warnings.append({"code": WARN_EXCEEDS, "message": WARNING_MESSAGES[WARN_EXCEEDS]})

    # US 1.1 AC4: missing pedestrian data.
    if quiet.score.level == LEVEL_UNAVAILABLE:
        warnings.append({"code": WARN_UNAVAILABLE,
                         "message": WARNING_MESSAGES[WARN_UNAVAILABLE]})

    routes = [quiet] if quiet.path == direct.path else [quiet, direct]
    return PlanResult(routes, warnings)
