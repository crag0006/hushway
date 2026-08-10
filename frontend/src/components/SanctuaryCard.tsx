import { Navigation, Phone, X, MapPin } from 'lucide-react'
import type { Sanctuary } from '../mockData'
import './SanctuaryCard.css'

interface Props {
  sanctuary: Sanctuary
  onClose?: () => void
}

export default function SanctuaryCard({ sanctuary, onClose }: Props) {
  return (
    <section className="sc" aria-label={`Sanctuary details: ${sanctuary.name}`}>
      <header className="sc__head">
        <span className="sc__chip">
          <span className="sc__chip-dot" />
          QUIET SANCTUARY
        </span>
        <button className="sc__close" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </header>

      <h3 className="sc__title">{sanctuary.name}</h3>
      <p className="sc__meta">
        <MapPin size={13} />
        <span>{sanctuary.distanceKm}km · {sanctuary.status}</span>
      </p>

      <div className="sc__actions">
        <button className="sc__btn sc__btn--primary">
          <Navigation size={16} />
          <span>Navigate</span>
        </button>
        <button className="sc__btn sc__btn--ghost">
          <Phone size={16} />
          <span>Call</span>
        </button>
      </div>

      <div className="sc__stats">
        <div className="sc__stat sc__stat--low">
          <h4>{sanctuary.noise.level}</h4>
          <div className="sc__stat-bar sc__stat-bar--low"><span /></div>
          <p>{sanctuary.noise.description}</p>
        </div>
        <div className="sc__stat sc__stat--quiet">
          <h4>{sanctuary.capacity.level}</h4>
          <div className="sc__stat-bar sc__stat-bar--quiet"><span /></div>
          <p>{sanctuary.capacity.description}</p>
        </div>
      </div>

      <footer className="sc__foot">
        <span>Inside Sanctuary</span>
        <button className="sc__more">View all</button>
      </footer>
    </section>
  )
}
