import './SensoryBadge.css'
import type { Sensory } from '../api/types'

const LABELS: Record<Sensory['level'], string> = {
  low: 'Low Sensory',
  high: 'High Sensory',
  unavailable: 'Sensory information unavailable',
}

export default function SensoryBadge({ level }: { level: Sensory['level'] }) {
  return <span className={`sensory-badge sensory-badge--${level}`}>{LABELS[level]}</span>
}
