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
]

export default function Header({ variant = 'solid' }: HeaderProps) {
  return (
    <header className={`hw-header hw-header--${variant}`}>
      <Link to="/" className="hw-header__brand">
        <span className="hw-header__logo" aria-hidden>
          <Flower2 size={18} strokeWidth={2.4} />
        </span>
        <span>HushWay</span>
      </Link>

      <nav className="hw-header__nav" aria-label="Primary navigation">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              `hw-header__link${isActive ? ' hw-header__link--active' : ''}`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
