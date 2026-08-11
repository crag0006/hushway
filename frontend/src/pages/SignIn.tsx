import { FormEvent, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer'
import './SignIn.css'

export default function SignIn() {
  const location = useLocation()
  const navigate = useNavigate()

  const [error, setError] = useState('')

  const accountCreated =
    location.state?.accountCreated === true

  const handleSignIn = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    setError('')

    const form = event.currentTarget
    const formData = new FormData(form)

    const email = formData.get('email') as string
    const password = formData.get('password') as string

    // Get account created in SignUp
    const storedUser = localStorage.getItem('hushwayUser')

    if (!storedUser) {
      setError(
        'No account found. Please create an account first.'
      )
      return
    }

    const user = JSON.parse(storedUser)

    // Check email and password
    if (
      user.email === email &&
      user.password === password
    ) {      
      localStorage.setItem('hushwayLoggedIn', 'true')

      // Successful login -> Explore page
      navigate('/explore')
    } else {
      setError(
        'Invalid email or password. Please try again.'
      )
    }
  }

  return (
    <div className="signin-page">
      <Header />

      <main className="signin-main">
        <div className="signin-card">

          {accountCreated && (
            <div className="signin-success">
              ✓ Your account successfully created.
            </div>
          )}

          <div className="signin-heading">
            <h1>Welcome back</h1>

            <p>
              Sign in to continue your quiet journey
              with HushWay.
            </p>
          </div>

          {error && (
            <div
                style={{
                  marginBottom: '20px',
                  padding: '12px 14px',
                  backgroundColor: '#fdecec',
                  border: '1px solid #ef9a9a',
                  borderLeft: '5px solid #c62828',
                  borderRadius: '8px',
                  color: '#b71c1c',
                  fontSize: '14px',
                  fontWeight: 600,
                  textAlign: 'center'
                }}
  >
          {error}
                </div>
              )}

          <form
            className="signin-form"
            onSubmit={handleSignIn}
          >

            <div className="signin-field">
              <label htmlFor="email">
                Email
              </label>

              <input
                type="email"
                id="email"
                name="email"
                placeholder="Enter your email"
                required
              />
            </div>

            <div className="signin-field">
              <label htmlFor="password">
                Password
              </label>

              <input
                type="password"
                id="password"
                name="password"
                placeholder="Enter your password"
                required
              />
            </div>

            <div className="signin-options">

              <label className="remember-me">
                <input type="checkbox" />

                <span>
                  Remember me
                </span>
              </label>

              <Link
                to="/forgot-password"
                className="forgot-password"
              >
                Forgot password?
              </Link>

            </div>

            <button
              type="submit"
              className="signin-button"
            >
              Sign In
            </button>

          </form>

          <div className="signin-divider">
            <span>or</span>
          </div>

          <div className="signin-signup">
            <p>
              Don't have an account?

              <Link to="/register">
                Sign up
              </Link>
            </p>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  )
}