import { Cloud, TreePine } from 'lucide-react'
import Header from '../components/Header'
import SearchPanel from '../components/SearchPanel'
import SanctuaryCard from '../components/SanctuaryCard'
import PlaceCard from '../components/PlaceCard'
import MapView from '../components/MapView'
import { places, sanctuary, weather } from '../mockData'
import './RefugeMap.css'

export default function RefugeMap() {
  return (
    <div className="app-shell">
      <Header />
      <div className="map-page">
        <aside className="sidebar">
          <SearchPanel />
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
