import { useEffect, useState } from 'react'
import { Cloud } from 'lucide-react'
import Header from '../components/Header'
import SearchPanel from '../components/SearchPanel'
import RouteCard from '../components/RouteCard'
import MapView from '../components/MapView'
import WarningBanner from '../components/WarningBanner'
import { fetchPlaces } from '../api/client'
import type { Place } from '../api/types'
import { useRoute } from '../hooks/useRoute'
import { useSensitivity } from '../hooks/useSensitivity'
import { weather } from '../mockData'
import './RouteCompare.css'

export default function RouteCompare() {
  const [places, setPlaces] = useState<Place[]>([])
  const [placesError, setPlacesError] = useState<string | null>(null)
  const [originId, setOriginId] = useState<number | null>(null)
  const [destinationId, setDestinationId] = useState<number | null>(null)
  const { density, setDensity, threshold } = useSensitivity()
  const { data, loading, error } = useRoute(originId, destinationId, threshold)

  // Warnings the user has acknowledged. Keyed by warning code, which the API
  // guarantees is unique per response.
  const [dismissedWarnings, setDismissedWarnings] = useState<string[]>([])

  const dismissWarning = (code: string) =>
    setDismissedWarnings((current) =>
      current.includes(code) ? current : [...current, code],
    )

  // A new plan is a new set of warnings, so an acknowledgement of the old ones
  // must not silence them.
  useEffect(() => {
    setDismissedWarnings([])
  }, [originId, destinationId, threshold])

  useEffect(() => {
    fetchPlaces()
      .then((result) => {
        setPlaces(result)
        // An empty list is not an error, but it leaves unusable dropdowns, so
        // say why rather than showing two empty menus.
        setPlacesError(result.length === 0 ? 'No places were returned by the API.' : null)
      })
      .catch((err: Error) => {
        setPlaces([])
        setPlacesError(err.message)
      })
  }, [])

  const routes = data?.routes ?? []
  const warnings = (data?.warnings ?? []).filter(
    (w) => !dismissedWarnings.includes(w.code),
  )

  return (
    <div className="app-shell">
      <Header />
      <div className="map-page">
        <aside className="sidebar">
          <SearchPanel
            places={places}
            originId={originId}
            destinationId={destinationId}
            density={density}
            onOriginChange={setOriginId}
            onDestinationChange={setDestinationId}
            onDensityChange={setDensity}
          />

          {placesError && (
            <p className="rc-page__status rc-page__status--error">
              Could not load places, so the menus are empty. Is the backend running on{' '}
              <code>localhost:8000</code>? Check <code>logs/backend.log</code>.
              <br />
              <small>{placesError}</small>
            </p>
          )}

          {loading && <p className="rc-page__status">Finding calmer routes…</p>}
          {error && <p className="rc-page__status rc-page__status--error">{error}</p>}
          {!placesError && !loading && !error && (originId === null || destinationId === null) && (
            <p className="rc-page__status">Choose a starting point and destination.</p>
          )}

          {routes.map((r, i) => (
            <RouteCard key={r.id} route={r} recommended={i === 0} />
          ))}
        </aside>

        <main className="map-area">
          <MapView routes={routes} />

          <div className="rc-page__overlay-top">
            <div className="rc-page__warning-wrap">
              {warnings.map((w) => (
                <WarningBanner
                  key={w.code}
                  title="Warning"
                  message={w.message}
                  onAllow={() => dismissWarning(w.code)}
                  onIgnore={() => dismissWarning(w.code)}
                />
              ))}
            </div>
            <div className="rc-page__weather">
              <Cloud size={16} />
              <span>{weather.temperatureC}°</span>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
