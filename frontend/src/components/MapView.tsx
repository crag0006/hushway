import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet'
import L from 'leaflet'
import { MELBOURNE_CBD, routes, places, type LatLng } from '../mockData'
import './MapView.css'

// Fix default marker icon paths (Leaflet with bundlers)
const yellowPin = L.divIcon({
  className: 'hw-map__pin',
  html: `<div class="hw-map__pin-inner"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
  iconSize: [46, 46],
  iconAnchor: [23, 42],
})

const placeIcon = L.divIcon({
  className: 'hw-map__place',
  html: `<div class="hw-map__place-inner"></div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
})

export default function MapView({ center = MELBOURNE_CBD }: { center?: LatLng }) {
  return (
    <div className="hw-map">
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom
        className="hw-map__container"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {routes.map((r) => (
          <Polyline
            key={r.id}
            positions={r.path}
            pathOptions={{
              color: r.color,
              weight: 8,
              opacity: 0.9,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        ))}

        <Marker position={center} icon={yellowPin}>
          <Popup>You are here</Popup>
        </Marker>

        {places.map((p) => (
          <Marker key={p.id} position={p.position} icon={placeIcon}>
            <Popup>{p.name}</Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
