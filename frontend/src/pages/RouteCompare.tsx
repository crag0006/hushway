import { Cloud } from 'lucide-react'
import Header from '../components/Header'
import SearchPanel from '../components/SearchPanel'
import RouteCard from '../components/RouteCard'
import PlaceCard from '../components/PlaceCard'
import MapView from '../components/MapView'
import WarningBanner from '../components/WarningBanner'
import { routes, places, warning, weather } from '../mockData'
import './RouteCompare.css'

export default function RouteCompare() {
  return (
    <div className="app-shell">
      <Header />
      <div className="map-page">
        <aside className="sidebar">
          <SearchPanel />
          {routes.map((r, i) => (
            <RouteCard key={r.id} route={r} recommended={i === 0} />
          ))}
        </aside>

        <main className="map-area">
          <MapView />

          <div className="rc-page__overlay-top">
            <div className="rc-page__warning-wrap">
              <WarningBanner title={warning.title} message={warning.message} />
            </div>
            <div className="rc-page__weather">
              <Cloud size={16} />
              <span>{weather.temperatureC}°</span>
            </div>
          </div>

          <div className="rc-page__places">
            {places.map((p) => (
              <PlaceCard key={p.id} place={p} />
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}
