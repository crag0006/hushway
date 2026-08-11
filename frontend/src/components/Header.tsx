import { useState } from 'react'
import {
  NavLink,
  Link,
  useNavigate
} from 'react-router-dom'
import { Flower2 } from 'lucide-react'
import './Header.css'

interface HeaderProps {
  variant?: 'overlay' | 'solid'
}

interface StoredUser {
  username?: string
  email?: string
}

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/explore', label: 'Explore' },
  { to: '/quietplace', label: 'QuietPlace' },
  { to: '/community', label: 'Community' },
  { to: '/resources', label: 'Resources' },
  { to: '/contact', label: 'Contact' },
]

export default function Header({
  variant = 'solid',
}: HeaderProps) {
  const navigate = useNavigate()

  const [showUserMenu, setShowUserMenu] =
    useState(false)

  const [isLoggedIn, setIsLoggedIn] =
    useState(
      localStorage.getItem('hushwayLoggedIn') === 'true'
    )

  const storedUser =
    localStorage.getItem('hushwayUser')

  let user: StoredUser | null = null

  if (storedUser) {
    try {
      user = JSON.parse(storedUser)
    } catch {
      user = null
    }
  }

  const username =
    user?.username || 'User'

  const handleSignOut = () => {
    // Remove only logged-in status.
    // Registered account information remains.
    localStorage.removeItem('hushwayLoggedIn')

    setIsLoggedIn(false)
    setShowUserMenu(false)

    // Return to Home page
    navigate('/')
  }

  return (
    <header
      className={`hw-header hw-header--${variant}`}
    >
      {/* Logo */}
      <Link
        to="/"
        className="hw-header__brand"
      >
        <Flower2
          className="hw-header__logo-icon"
          size={20}
        />

        <span>HushWay</span>
      </Link>

      {/* Navigation */}
      <nav
        className="hw-header__nav"
        aria-label="Primary navigation"
      >
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              `hw-header__link${
                isActive
                  ? ' hw-header__link--active'
                  : ''
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>

      {/* Login / User section */}
      <div className="hw-header__auth">
        {isLoggedIn ? (
          <div className="hw-header__user">
            <button
              type="button"
              className="hw-header__username"
              onClick={() =>
                setShowUserMenu(
                  !showUserMenu
                )
              }
              aria-expanded={showUserMenu}
            >
              {username}

              <span className="hw-header__arrow">
                ▾
              </span>
            </button>

            {showUserMenu && (
              <div className="hw-header__dropdown">
                <button
                  type="button"
                  className="hw-header__signout"
                  onClick={handleSignOut}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link
            to="/signin"
            className="hw-header__btn hw-header__btn--ghost"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  )
}