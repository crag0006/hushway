import { AlertTriangle } from 'lucide-react'
import './WarningBanner.css'

interface Props {
  title: string
  message: string
  onAllow?: () => void
  onIgnore?: () => void
}

export default function WarningBanner({ title, message, onAllow, onIgnore }: Props) {
  return (
    <div className="wb" role="alert" aria-live="assertive">
      <div className="wb__icon"><AlertTriangle size={22} /></div>
      <div className="wb__body">
        <strong className="wb__title">{title}</strong>
        <span className="wb__msg">{message}</span>
      </div>
      <div className="wb__actions">
        <button className="wb__btn wb__btn--allow" onClick={onAllow}>Allow</button>
        <button className="wb__btn wb__btn--ignore" onClick={onIgnore}>Ignore</button>
      </div>
    </div>
  )
}
