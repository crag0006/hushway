import { Volume2, Zap, Navigation } from 'lucide-react'
import type { RouteOption } from '../mockData'
import './RouteCard.css'

interface Props {
  route: RouteOption
  recommended?: boolean
  onStart?: () => void
}

export default function RouteCard({ route, recommended, onStart }: Props) {
  const isQuiet = route.type === 'quiet'
  const Icon = isQuiet ? Volume2 : Zap
  return (
    <article className={`rc rc--${route.type}`}>
      {recommended && <span className="rc__tag">RECOMMENDED</span>}
      <div className="rc__header">
        <h3 className="rc__title">{route.label}</h3>
        <div className="rc__meta">
          <div className="rc__duration">{route.duration}</div>
          <div className="rc__submeta">
            <Icon size={14} />
            <span>{route.meta}</span>
          </div>
        </div>
      </div>
      <p className="rc__desc">{route.description}</p>
      <button className="rc__btn" onClick={onStart}>
        <Navigation size={16} />
        <span>Start {route.label}</span>
      </button>
    </article>
  )
}
