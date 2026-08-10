export type LatLng = [number, number]

export interface Place {
  id: number
  name: string
  kind: string
  lat: number
  lng: number
}

export interface Sensory {
  level: 'low' | 'high' | 'unavailable'
  score: number
  peak_count: number
  coverage: number
}

export interface Congestion {
  peak: number
  mean: number
}

export interface ApiRoute {
  id: string
  type: 'quiet' | 'direct'
  path: LatLng[]
  distance_m: number
  duration_min: number
  sensory: Sensory
  congestion: Congestion
}

export interface ApiWarning {
  code: 'SENSORY_DATA_UNAVAILABLE' | 'NO_LOWER_CONGESTION_ROUTE' | 'EXCEEDS_PREFERRED_THRESHOLD'
  message: string
}

export interface RoutesResponse {
  routes: ApiRoute[]
  warnings: ApiWarning[]
  threshold_used: number
}

export interface RouteQuery {
  originId: number
  destinationId: number
  threshold?: number
  dow?: number
  hour?: number
}
