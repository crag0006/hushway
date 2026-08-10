import { useEffect, useState } from 'react'
import { Cloud, TreePine } from 'lucide-react'
import Header from '../components/Header'
import SearchPanel from '../components/SearchPanel'
import SanctuaryCard from '../components/SanctuaryCard'
import PlaceCard from '../components/PlaceCard'
import MapView from '../components/MapView'
import { fetchPlaces } from '../api/client'
import type { Place } from '../api/types'
import { useSensitivity } from '../hooks/useSensitivity'
import { places, sanctuary, weather } from '../mockData'
import './RefugeMap.css'

export default function RefugeMap() {
  // EPIC-2 page: the panel is shared with route planning, so it needs the same
  // props. Refuge search itself is not implemented yet.
  const [landmarks, setLandmarks] = useState<Place[]>([])
  const [originId, setOriginId] = useState<number | null>(null)
  const [destinationId, setDestinationId] = useState<number | null>(null)
  const { density, setDensity } = useSensitivity()

  useEffect(() => {
    fetchPlaces().then(setLandmarks).catch(() => setLandmarks([]))
  }, [])

  return (
    <div className="app-shell">
      <Header />
      <div className="map-page">
        <aside className="sidebar">
          <SearchPanel
            places={landmarks}
            originId={originId}
            destinationId={destinationId}
            density={density}
            onOriginChange={setOriginId}
            onDestinationChange={setDestinationId}
            onDensityChange={setDensity}
          />
          <SanctuaryCard sanctuary={sanctuary} />
        </aside>

        <main className="map-area">
          <MapView />

          <div className="rm-page__weather">
            <Cloud size={16} />
            <span>{weather.temperatureC}°</span>
          </div>

          <button className="rm-page__fab" aria-label="Nearby quiet places">
            <TreePine size={22} />
          </button>

          <div className="rm-page__places">
            {places.map((p) => (
              <PlaceCard key={p.id} place={p} />
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}
