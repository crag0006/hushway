import Header from '../components/Header'
import Footer from '../components/Footer'

export default function Community() {
  return (
    <div>
      <Header />
      <main style={{ maxWidth: 780, margin: '80px auto', padding: '0 24px' }}>
        <h1 style={{ fontSize: 42, fontWeight: 700, letterSpacing: '-1px' }}>Community</h1>
        <p style={{ color: 'var(--mute)', fontSize: 17, lineHeight: 1.6 }}>
          The Sunflower Community, tips from sensory-aware travellers, and shared quiet routes.
          Coming soon.
        </p>
      </main>
      <Footer />
    </div>
  )
}
