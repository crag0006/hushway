"""API response models."""

from pydantic import BaseModel


class PlaceOut(BaseModel):
    id: int
    name: str
    kind: str
    lat: float
    lng: float


class PlacesResponse(BaseModel):
    places: list[PlaceOut]


class SensoryOut(BaseModel):
    level: str
    score: float
    peak_count: float
    coverage: float


class CongestionOut(BaseModel):
    peak: float
    mean: float


class RouteOut(BaseModel):
    id: str
    type: str
    path: list[list[float]]
    distance_m: float
    duration_min: int
    sensory: SensoryOut
    congestion: CongestionOut


class WarningOut(BaseModel):
    code: str
    message: str


class RoutesResponse(BaseModel):
    routes: list[RouteOut]
    warnings: list[WarningOut]
    threshold_used: int
