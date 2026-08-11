import { Link } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer'
import './Home.css'

export default function Home() {
  return (
    <div className="home">
      <section className="home__hero">
        <div className="home__hero-bg" aria-hidden />
        <div className="home__hero-tint" aria-hidden />
        <Header variant="overlay" />

        <div className="home__hero-content">
          <h1 className="home__title">HushWay</h1>
          <p className="home__subtitle">A Quiet Journey</p>
          <div className="home__ctas">
            <Link to="/explore" className="home__cta">Explore</Link>
            <Link to="/quietplace" className="home__cta home__cta--ghost">Quiet</Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
