import Header from '../components/Header'
import Footer from '../components/Footer'

export default function Resources() {
  return (
    <div>
      <Header />
      <main style={{ maxWidth: 780, margin: '80px auto', padding: '0 24px' }}>
        <h1 style={{ fontSize: 42, fontWeight: 700, letterSpacing: '-1px' }}>Resources</h1>
        <p style={{ color: 'var(--mute)', fontSize: 17, lineHeight: 1.6 }}>
          Open data sources, developer docs, colour system, and support material.
        </p>
      </main>
      <Footer />
    </div>
  )
}
