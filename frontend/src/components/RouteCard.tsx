import SensoryBadge from './SensoryBadge'
import type { ApiRoute } from '../api/types'
import './RouteCard.css'

const TITLES: Record<ApiRoute['type'], string> = {
  quiet: 'Quiet Route',
  direct: 'Fastest Route',
}

export default function RouteCard({
  route,
  recommended,
}: {
  route: ApiRoute
  recommended: boolean
}) {
  const km = (route.distance_m / 1000).toFixed(1)

  return (
    <article
      className={[
        'route-card',
        `route-card--${route.type === 'quiet' ? 'quiet' : 'fast'}`,
        recommended ? 'route-card--recommended' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <header className="route-card__head">
        <h3 className="route-card__title">{TITLES[route.type]}</h3>
        {recommended && <span className="route-card__flag">Recommended</span>}
      </header>

      <p className="route-card__meta">
        {route.duration_min} min · {km} km
      </p>

      <SensoryBadge level={route.sensory.level} />

      {route.sensory.level !== 'unavailable' && (
        <p className="route-card__detail">Peak {Math.round(route.congestion.peak)} people/hr</p>
      )}
    </article>
  )
}
