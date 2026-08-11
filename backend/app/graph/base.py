"""Graph abstractions. Swapping in real OSM geometry means implementing GraphProvider."""

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class Node:
    node_id: int
    lat: float
    lon: float
    sensor_id: int


@dataclass(frozen=True)
class Edge:
    from_id: int
    to_id: int
    length_m: float


class GraphProvider(Protocol):
    def nodes(self) -> list[Node]: ...

    def edges(self) -> list[Edge]: ...

    def node(self, node_id: int) -> Node: ...

    def neighbours(self, node_id: int) -> list[tuple[int, float]]: ...

    def snap(self, lat: float, lon: float) -> Node: ...
