import Header from '../components/Header'
import Footer from '../components/Footer'

export default function Contact() {
  return (
    <div>
      <Header />
      <main style={{ maxWidth: 780, margin: '80px auto', padding: '0 24px' }}>
        <h1 style={{ fontSize: 42, fontWeight: 700, letterSpacing: '-1px' }}>Contact</h1>
        <p style={{ color: 'var(--mute)', fontSize: 17, lineHeight: 1.6 }}>
          Get in touch with the Monash FIT5120 TE28 team.
        </p>
      </main>
      <Footer />
    </div>
  )
}
