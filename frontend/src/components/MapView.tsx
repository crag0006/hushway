import { MapContainer, TileLayer, Polyline, Popup } from 'react-leaflet'
import type { ApiRoute, LatLng } from '../api/types'
import './MapView.css'

const MELBOURNE_CBD: LatLng = [-37.8136, 144.9631]

const COLORS: Record<ApiRoute['type'], string> = {
  quiet: '#5EE39C',
  direct: '#C22A2A',
}

export default function MapView({
  routes = [],
  center = MELBOURNE_CBD,
}: {
  routes?: ApiRoute[]
  center?: LatLng
}) {
  return (
    <div className="hw-map">
      <MapContainer center={center} zoom={14} scrollWheelZoom className="hw-map__container">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {routes.map((route) => (
          <Polyline
            key={route.id}
            positions={route.path}
            pathOptions={{ color: COLORS[route.type], weight: 5, opacity: 0.85 }}
          >
            <Popup>
              {route.type === 'quiet' ? 'Quiet Route' : 'Fastest Route'} · {route.duration_min} min
            </Popup>
          </Polyline>
        ))}
      </MapContainer>
    </div>
  )
}
