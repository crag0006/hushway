import Header from '../components/Header'
import Footer from '../components/Footer'

export default function Register() {
  return (
    <div>
      <Header />
      <main style={{ maxWidth: 420, margin: '80px auto', padding: '0 24px' }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.5px' }}>Register</h1>
        <p style={{ color: 'var(--mute)' }}>Registration coming soon.</p>
      </main>
      <Footer />
    </div>
  )
}
