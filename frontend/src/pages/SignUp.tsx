import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer'
import './SignUp.css'

export default function SignUp() {
  const navigate = useNavigate()

  const [error, setError] = useState('')

  const handleSignUp = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    setError('')

    const form = event.currentTarget
    const formData = new FormData(form)

    const username = formData.get('username') as string
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const confirmPassword = formData.get('confirmPassword') as string

    // Check if passwords match
    if (password !== confirmPassword) {
      setError('Password and Confirm Password do not match.')
      return
    }

    // Store account temporarily for prototype/demo
    const user = {
      username,
      email,
      password
    }

    localStorage.setItem(
      'hushwayUser',
      JSON.stringify(user)
    )

    // Go to Sign In page
    navigate('/signin', {
      state: {
        accountCreated: true
      }
    })
  }

  return (
    <div className="register-page">
      <Header />

      <main className="register-main">
        <div className="register-card">

          <div className="register-heading">
            <h1>Create your account</h1>

            <p>
              Join HushWay and start planning calmer,
              sensory-friendly journeys.
            </p>
          </div>

          {error && (
            <div className="register-error">
              {error}
            </div>
          )}

          <form
            className="register-form"
            onSubmit={handleSignUp}
          >

            <div className="register-field">
              <label htmlFor="username">
                First Name
              </label>

              <input
                type="text"
                id="firstname"
                name="firstname"
                placeholder="Enter your first name"
                required
              />
            </div>

            <div className="register-field">
              <label htmlFor="username">
                Last Name
              </label>

              <input
                type="text"
                id="lastname"
                name="lastname"
                placeholder="Enter your last name"
                required
              />
            </div>

            <div className="register-field">
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

            <div className="register-field">
              <label htmlFor="password">
                Password
              </label>

              <input
                type="password"
                id="password"
                name="password"
                placeholder="Create a password"
                required
              />
            </div>

            <div className="register-field">
              <label htmlFor="confirmPassword">
                Confirm Password
              </label>

              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                placeholder="Re-enter your password"
                required
              />
            </div>

            <div className="register-terms">
              <label>

                <input
                  type="checkbox"
                  required
                />

                <span>
                  I agree to the Terms and Privacy Policy
                </span>

              </label>
            </div>

            <button
              type="submit"
              className="register-button"
            >
              Create Account
            </button>

          </form>

          <div className="register-divider">
            <span>or</span>
          </div>

          <div className="register-signin">
            <p>
              Already have an account?

              <Link to="/signin">
                Sign in
              </Link>
            </p>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  )
}