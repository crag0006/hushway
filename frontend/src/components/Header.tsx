import { NavLink, Link } from 'react-router-dom'
import { Flower2 } from 'lucide-react'
import './Header.css'

interface HeaderProps {
  variant?: 'overlay' | 'solid'
}

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/explore', label: 'Explore' },
  { to: '/quietplace', label: 'QuietPlace' },
  { to: '/community', label: 'Community' },
  { to: '/resources', label: 'Resources' },
  { to: '/contact', label: 'Contact' },
]

export default function Header({ variant = 'solid' }: HeaderProps) {
  return (
    <header className={`hw-header hw-header--${variant}`}>
      <Link to="/" className="hw-header__brand" aria-label="HushWay home">
        <Flower2 size={22} strokeWidth={2.2} className="hw-header__logo-icon" />
        <span className="hw-header__brand-text">HushWay</span>
      </Link>

      <nav className="hw-header__nav" aria-label="Primary">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) =>
              `hw-header__link${isActive ? ' hw-header__link--active' : ''}`
            }
          >
            {l.label}
          </NavLink>
        ))}
      </nav>

      <div className="hw-header__auth">
        <Link to="/signin" className="hw-header__btn hw-header__btn--ghost">
          Sign in
        </Link>
        <Link to="/register" className="hw-header__btn hw-header__btn--solid">
          Register
        </Link>
      </div>
    </header>
  )
}
