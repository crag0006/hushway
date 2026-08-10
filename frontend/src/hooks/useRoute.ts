import { useEffect, useState } from 'react'
import { fetchRoutes } from '../api/client'
import type { RoutesResponse } from '../api/types'

/**
 * Fetch routes for the given trip. Re-runs whenever the threshold changes,
 * which is what keeps the recommendation current (US 1.3 AC5).
 */
export function useRoute(
  originId: number | null,
  destinationId: number | null,
  threshold: number,
) {
  const [data, setData] = useState<RoutesResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (originId === null || destinationId === null) {
      setData(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    fetchRoutes({ originId, destinationId, threshold })
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [originId, destinationId, threshold])

  return { data, loading, error }
}
