import { useState } from 'react'
import {
  ArrowLeft,
  Bookmark,
  Car,
  Bus,
  Footprints,
  Accessibility,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { Place } from '../api/types'
import type { Density } from '../hooks/useSensitivity'
import './SearchPanel.css'

type TravelMode = 'drive' | 'transit' | 'walk' | 'accessible'

const modes: { id: TravelMode; label: string; Icon: LucideIcon }[] = [
  { id: 'drive', label: 'Drive', Icon: Car },
  { id: 'transit', label: 'Transit', Icon: Bus },
  { id: 'walk', label: 'Walk', Icon: Footprints },
  { id: 'accessible', label: 'Accessible', Icon: Accessibility },
]

const densities: { id: Density; label: string; Icon: LucideIcon }[] = [
  { id: 'low', label: 'Low', Icon: User },
  { id: 'mid', label: 'Mid', Icon: Users },
  { id: 'high', label: 'High', Icon: Users },
]

interface SearchPanelProps {
  places: Place[]
  originId: number | null
  destinationId: number | null
  density: Density
  onOriginChange: (id: number | null) => void
  onDestinationChange: (id: number | null) => void
  onDensityChange: (density: Density) => void
}

export default function SearchPanel({
  places,
  originId,
  destinationId,
  density,
  onOriginChange,
  onDestinationChange,
  onDensityChange,
}: SearchPanelProps) {
  const [mode, setMode] = useState<TravelMode>('walk')

  return (
    <section className="sp" aria-label="Search and preferences">
      <header className="sp__top">
        <button className="sp__icon-btn" aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <button className="sp__icon-btn" aria-label="Bookmark">
          <Bookmark size={20} />
        </button>
      </header>

      <div className="sp__search">
        <div className="sp__rail" aria-hidden>
          <span className="sp__rail-dot sp__rail-dot--o" />
          <span className="sp__rail-line" />
          <span className="sp__rail-dot sp__rail-dot--d" />
        </div>
        <div className="sp__inputs">
          <div className="sp__input">
            <select
              aria-label="Origin"
              value={originId ?? ''}
              onChange={(e) => onOriginChange(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Choose a starting point</option>
              {places.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sp__input">
            <select
              aria-label="Destination"
              value={destinationId ?? ''}
              onChange={(e) => onDestinationChange(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Choose a destination</option>
              {places.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="sp__group">
        <h4 className="sp__label">TRAVEL MODE</h4>
        <div className="sp__pill-row" role="tablist" aria-label="Travel mode">
          {modes.map(({ id, label, Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={mode === id}
              className={`sp__mode${mode === id ? ' sp__mode--active' : ''}`}
              onClick={() => setMode(id)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="sp__group">
        <h4 className="sp__label">CROWD DENSITY PREFERENCE</h4>
        <div className="sp__pill-row sp__pill-row--three" role="tablist" aria-label="Crowd density">
          {densities.map(({ id, label, Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={density === id}
              className={`sp__density${density === id ? ' sp__density--active' : ''}`}
              onClick={() => onDensityChange(id)}
            >
              <Icon size={16} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
