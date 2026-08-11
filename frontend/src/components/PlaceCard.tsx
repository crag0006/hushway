import { Star, Volume2, Users, Lightbulb, Navigation } from 'lucide-react'
import type { Place } from '../mockData'
import './PlaceCard.css'

const iconMap = { volume: Volume2, people: Users, light: Lightbulb }

export default function PlaceCard({ place }: { place: Place }) {
  const Icon = iconMap[place.descriptorIcon]
  return (
    <article className="pc">
      <div
        className="pc__image"
        style={{ backgroundImage: `url(${place.image})` }}
        aria-hidden
      />
      <div className="pc__body">
        <h4 className="pc__name">{place.name}</h4>
        <div className="pc__score">
          <Star size={13} fill="#F5B932" strokeWidth={0} />
          <span><strong>{place.sensoryScore}</strong> Sensory Score</span>
        </div>
        <div className="pc__desc">
          <Icon size={13} />
          <span>{place.descriptor}</span>
        </div>
      </div>
      <button className="pc__nav" aria-label={`Navigate to ${place.name}`}>
        <Navigation size={16} />
      </button>
    </article>
  )
}
