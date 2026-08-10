"""Dijkstra path finding with pluggable edge cost."""

import heapq
import math

from app.services.scoring import edge_count

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
