import { useState } from 'react'
import {
  ArrowLeft,
  Bookmark,
  X,
  Mic,
  Car,
  Bus,
  Footprints,
  Accessibility,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react'
import './SearchPanel.css'

type TravelMode = 'drive' | 'transit' | 'walk' | 'accessible'
type Density = 'low' | 'mid' | 'high'

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

export default function SearchPanel() {
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('CBD')
  const [mode, setMode] = useState<TravelMode>('transit')
  const [density, setDensity] = useState<Density>('low')

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
            <input
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              placeholder="Search"
              aria-label="Origin"
            />
            <button className="sp__input-btn" aria-label="Clear origin" onClick={() => setOrigin('')}>
              <X size={16} />
            </button>
          </div>
          <div className="sp__input">
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Destination"
              aria-label="Destination"
            />
            <button className="sp__input-btn" aria-label="Voice">
              <Mic size={16} />
            </button>
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
              onClick={() => setDensity(id)}
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
