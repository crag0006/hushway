import type { Place, RouteQuery, RoutesResponse } from './types'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

async function getJson<T>(path: string, params: Record<string, string>): Promise<T> {
  const query = new URLSearchParams(params).toString()
  const response = await fetch(`${BASE_URL}${path}${query ? `?${query}` : ''}`)
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}): ${path}`)
  }
  return (await response.json()) as T
}

export async function fetchPlaces(q = ''): Promise<Place[]> {
  const body = await getJson<{ places: Place[] }>('/api/places', q ? { q } : {})
  return body.places
}

export async function fetchRoutes(query: RouteQuery): Promise<RoutesResponse> {
  const params: Record<string, string> = {
    origin_id: String(query.originId),
    destination_id: String(query.destinationId),
  }
  if (query.threshold !== undefined) params.threshold = String(query.threshold)
  if (query.dow !== undefined) params.dow = String(query.dow)
  if (query.hour !== undefined) params.hour = String(query.hour)
  return getJson<RoutesResponse>('/api/routes', params)
}
