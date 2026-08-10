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
  const [originId, setOriginId] = useState<number | null>(null)
  const [destinationId, setDestinationId] = useState<number | null>(null)
  const { density, setDensity, threshold } = useSensitivity()
  const { data, loading, error } = useRoute(originId, destinationId, threshold)

  useEffect(() => {
    fetchPlaces().then(setPlaces).catch(() => setPlaces([]))
  }, [])

  const routes = data?.routes ?? []
  const warnings = data?.warnings ?? []

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

          {loading && <p className="rc-page__status">Finding calmer routes…</p>}
          {error && <p className="rc-page__status">Could not reach the route service.</p>}
          {!loading && !error && (originId === null || destinationId === null) && (
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
                <WarningBanner key={w.code} title="Warning" message={w.message} />
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
