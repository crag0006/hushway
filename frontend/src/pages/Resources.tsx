import { Link } from 'react-router-dom'
import {
  Leaf,
  Gauge,
  MapPin,
  Accessibility,
  Heart,
  Database,
  Footprints,
  Volume2,
  Sun,
  Users,
  CircleHelp,
  ShieldCheck,
  TriangleAlert,
  ArrowRight,
  Trees,
  Library,
  Coffee,
  Headphones,
  Route
} from 'lucide-react'

import Header from '../components/Header'
import Footer from '../components/Footer'
import './Resources.css'

export default function Resources() {
  return (
    <div className="resources-page">

      <Header />

      <main className="resources-main">

        {/* =====================================
            HERO
        ====================================== */}

        <section className="resources-hero">

          <div className="resources-hero__content">

            <span className="resources-eyebrow">
              HushWay Resources
            </span>

            <h1>
              Helpful information for calmer travel.
            </h1>

            <p>
              Learn how to understand sensory levels,
              discover quiet places and prepare for a
              more comfortable journey through the city.
            </p>

          </div>

        </section>


        {/* =====================================
            RESOURCE CARDS
        ====================================== */}

        <section className="resources-section">

          <div className="resources-section-heading">
            <h2>Explore HushWay Resources</h2>

            <p>
              Information to help you understand and use
              HushWay more confidently.
            </p>
          </div>


          <div className="resources-card-grid">

            {/* Sensory Travel Guide */}
            <article className="resources-card">

              <div className="resources-card-icon">
                <Leaf size={26} />
              </div>

              <h3>Sensory-Friendly Travel Guide</h3>

              <p>
                Simple strategies for planning quieter,
                less crowded and more comfortable journeys.
              </p>

              <a href="#travel-guide">
                Learn more
                <ArrowRight size={16} />
              </a>

            </article>


            {/* Sensory Levels */}
            <article className="resources-card">

              <div className="resources-card-icon">
                <Gauge size={26} />
              </div>

              <h3>Understanding Sensory Levels</h3>

              <p>
                Learn what Low, Medium and High sensory
                conditions mean when viewing your journey.
              </p>

              <a href="#sensory-levels">
                Learn more
                <ArrowRight size={16} />
              </a>

            </article>


            {/* Quiet Places */}
            <article className="resources-card">

              <div className="resources-card-icon">
                <MapPin size={26} />
              </div>

              <h3>Quiet Places</h3>

              <p>
                Understand the types of locations that may
                provide a calmer place to pause and recover.
              </p>

              <a href="#quiet-places">
                Learn more
                <ArrowRight size={16} />
              </a>

            </article>


            {/* Accessibility */}
            <article className="resources-card">

              <div className="resources-card-icon">
                <Accessibility size={26} />
              </div>

              <h3>Accessible Travel</h3>

              <p>
                Find information about inclusive travel
                options and accessible journey planning.
              </p>

              <a href="#accessibility">
                Learn more
                <ArrowRight size={16} />
              </a>

            </article>


            {/* Calm support */}
            <article className="resources-card">

              <div className="resources-card-icon">
                <Heart size={26} />
              </div>

              <h3>When You Feel Overwhelmed</h3>

              <p>
                Quick steps you can take when your current
                environment becomes too stimulating.
              </p>

              <a href="#calm-support">
                View tips
                <ArrowRight size={16} />
              </a>

            </article>


            {/* Data */}
            <article className="resources-card">

              <div className="resources-card-icon">
                <Database size={26} />
              </div>

              <h3>Open Data Sources</h3>

              <p>
                Learn about the types of urban data used
                to support HushWay sensory information.
              </p>

              <a href="#open-data">
                View data information
                <ArrowRight size={16} />
              </a>

            </article>

          </div>

        </section>


        {/* =====================================
            TRAVEL GUIDE
        ====================================== */}

        <section
          className="resources-guide"
          id="travel-guide"
        >

          <div className="resources-section-heading">
            <span className="resources-section-label">
              Travel Guide
            </span>

            <h2>
              Plan a calmer journey
            </h2>

            <p>
              Small changes before and during a journey
              can help reduce unnecessary sensory pressure.
            </p>
          </div>


          <div className="resources-guide-grid">

            <div className="resources-guide-item">

              <Footprints size={23} />

              <div>
                <h3>Choose a quieter route</h3>

                <p>
                  When available, select routes that avoid
                  heavily crowded streets and busy areas.
                </p>
              </div>

            </div>


            <div className="resources-guide-item">

              <Headphones size={23} />

              <div>
                <h3>Prepare for noise</h3>

                <p>
                  Consider carrying headphones or other
                  tools that help reduce unwanted noise.
                </p>
              </div>

            </div>


            <div className="resources-guide-item">

              <MapPin size={23} />

              <div>
                <h3>Know your quiet places</h3>

                <p>
                  Identify nearby parks, libraries or other
                  calmer places before starting your journey.
                </p>
              </div>

            </div>


            <div className="resources-guide-item">

              <Route size={23} />

              <div>
                <h3>Be ready to change your journey</h3>

                <p>
                  If conditions become uncomfortable,
                  consider changing your route or travel time.
                </p>
              </div>

            </div>

          </div>

        </section>


        {/* =====================================
            SENSORY LEVELS
        ====================================== */}

        <section
          className="resources-sensory"
          id="sensory-levels"
        >

          <div className="resources-section-heading">

            <span className="resources-section-label">
              Sensory Information
            </span>

            <h2>
              Understanding sensory levels
            </h2>

            <p>
              HushWay uses simple sensory indicators to
              help users compare different travel conditions.
            </p>

          </div>


          <div className="resources-level-grid">

            {/* Low */}
            <div className="resources-level-card resources-level-card--low">

              <div className="resources-level-title">

                <span className="resources-level-dot"></span>

                <h3>Low Sensory</h3>

              </div>

              <p>
                A generally calmer environment with fewer
                people and lower levels of stimulation.
              </p>

              <ul>
                <li>Lower pedestrian activity</li>
                <li>Potentially quieter surroundings</li>
                <li>Suitable when a calmer route is preferred</li>
              </ul>

            </div>


            {/* Medium */}
            <div className="resources-level-card resources-level-card--medium">

              <div className="resources-level-title">

                <span className="resources-level-dot"></span>

                <h3>Medium Sensory</h3>

              </div>

              <p>
                A moderate level of activity that may feel
                comfortable for some users but busy for others.
              </p>

              <ul>
                <li>Moderate pedestrian activity</li>
                <li>Some environmental stimulation</li>
                <li>Conditions may change during travel</li>
              </ul>

            </div>


            {/* High */}
            <div className="resources-level-card resources-level-card--high">

              <div className="resources-level-title">

                <span className="resources-level-dot"></span>

                <h3>High Sensory</h3>

              </div>

              <p>
                A busier environment where higher crowds
                may create greater sensory stimulation.
              </p>

              <ul>
                <li>Higher pedestrian activity</li>
                <li>Potentially busy surroundings</li>
                <li>A quieter alternative may be helpful</li>
              </ul>

            </div>

          </div>

        </section>


        {/* =====================================
            QUIET PLACES
        ====================================== */}

        <section
          className="resources-quiet"
          id="quiet-places"
        >

          <div className="resources-section-heading">

            <span className="resources-section-label">
              Sensory Refuges
            </span>

            <h2>
              What can be a quiet place?
            </h2>

            <p>
              HushWay can highlight potential locations where
              users may find a calmer environment.
            </p>

          </div>


          <div className="resources-quiet-grid">

            <div className="resources-quiet-card">

              <div className="resources-quiet-icon">
                <Trees size={28} />
              </div>

              <h3>Parks & Gardens</h3>

              <p>
                Green spaces can provide more open surroundings
                and distance from busy city streets.
              </p>

            </div>


            <div className="resources-quiet-card">

              <div className="resources-quiet-icon">
                <Library size={28} />
              </div>

              <h3>Libraries</h3>

              <p>
                Libraries may provide indoor seating and
                quieter environments away from street activity.
              </p>

            </div>


            <div className="resources-quiet-card">

              <div className="resources-quiet-icon">
                <Coffee size={28} />
              </div>

              <h3>Low-Stimulation Indoor Spaces</h3>

              <p>
                Some indoor locations may offer lower noise,
                softer lighting and comfortable seating.
              </p>

            </div>

          </div>


          <div className="resources-action-center">

            <Link
              to="/quietplace"
              className="resources-primary-button"
            >
              Find Quiet Places

              <ArrowRight size={17} />
            </Link>

          </div>

        </section>


        {/* =====================================
            ACCESSIBILITY
        ====================================== */}

        <section
          className="resources-accessibility"
          id="accessibility"
        >

          <div className="resources-accessibility-icon">
            <Accessibility size={34} />
          </div>


          <div className="resources-accessibility-content">

            <span className="resources-section-label">
              Inclusive Travel
            </span>

            <h2>
              Accessibility matters
            </h2>

            <p>
              HushWay aims to support people who may experience
              sensory challenges when moving through busy urban
              environments. Journey preferences can differ from
              person to person, so users should remain in control
              of the routes and sensory settings they choose.
            </p>

          </div>

        </section>


        {/* =====================================
            CALM SUPPORT
        ====================================== */}

        <section
          className="resources-calm"
          id="calm-support"
        >

          <div className="resources-section-heading">

            <span className="resources-section-label">
              Calm Support
            </span>

            <h2>
              When you feel overwhelmed
            </h2>

            <p>
              HushWay can help you simplify your next travel decision.
            </p>

          </div>


          <div className="resources-calm-grid">

            <div className="resources-calm-step">
              <span>1</span>

              <div>
                <h3>Move away from the busiest area</h3>

                <p>
                  Look for a nearby location with lower crowds
                  or less environmental stimulation.
                </p>
              </div>
            </div>


            <div className="resources-calm-step">
              <span>2</span>

              <div>
                <h3>Find a quiet place</h3>

                <p>
                  Check HushWay for nearby potential sensory
                  refuges such as parks or libraries.
                </p>
              </div>
            </div>


            <div className="resources-calm-step">
              <span>3</span>

              <div>
                <h3>Re-plan your journey</h3>

                <p>
                  Choose a lower-congestion route when another
                  suitable option is available.
                </p>
              </div>
            </div>


            <div className="resources-calm-step">
              <span>4</span>

              <div>
                <h3>Reduce unnecessary stimulation</h3>

                <p>
                  Focus only on the information you need for
                  your immediate next step.
                </p>
              </div>
            </div>

          </div>


          <div className="resources-action-center">

            <Link
              to="/quietplace"
              className="resources-primary-button"
            >
              I Need a Calm Place

              <Heart size={17} />
            </Link>

          </div>

        </section>


        {/* =====================================
            OPEN DATA
        ====================================== */}

        <section
          className="resources-data"
          id="open-data"
        >

          <div className="resources-section-heading">

            <span className="resources-section-label">
              Data
            </span>

            <h2>Open Data Sources</h2>

            <p>
              HushWay can use available urban datasets to
              support sensory-aware journey information.
            </p>

          </div>


          <div className="resources-data-grid">

            <div className="resources-data-card">

              <div className="resources-data-icon">
                <Users size={24} />
              </div>

              <div>
                <h3>Pedestrian Count Data</h3>

                <p>
                  Pedestrian information can help estimate
                  whether an area is experiencing relatively
                  lower or higher crowd activity.
                </p>

                <span>Urban crowd information</span>
              </div>

            </div>


            <div className="resources-data-card">

              <div className="resources-data-icon">
                <MapPin size={24} />
              </div>

              <div>
                <h3>Sensor Location Data</h3>

                <p>
                  Sensor locations help connect pedestrian
                  information with specific areas of the city.
                </p>

                <span>Location information</span>
              </div>

            </div>


            <div className="resources-data-card">

              <div className="resources-data-icon">
                <Route size={24} />
              </div>

              <div>
                <h3>Map & Route Information</h3>

                <p>
                  Mapping information supports route
                  visualisation and navigation between
                  destinations and quiet places.
                </p>

                <span>Journey planning</span>
              </div>

            </div>

          </div>


          <div className="resources-data-note">

            <TriangleAlert size={19} />

            <p>
              Sensory information depends on the availability
              and quality of the underlying data. When reliable
              information is unavailable, HushWay should clearly
              indicate that sensory information is unavailable.
            </p>

          </div>

        </section>


        {/* =====================================
            FAQ
        ====================================== */}

        <section className="resources-faq">

          <div className="resources-section-heading">

            <span className="resources-section-label">
              Help
            </span>

            <h2>Frequently Asked Questions</h2>

            <p>
              Common questions about sensory-aware travel with HushWay.
            </p>

          </div>


          <div className="resources-faq-list">

            <details className="resources-faq-item">

              <summary>
                <span>
                  <CircleHelp size={18} />

                  How does HushWay determine sensory level?
                </span>

                <span className="resources-faq-plus">
                  +
                </span>
              </summary>

              <p>
                HushWay can use available pedestrian information
                and defined thresholds to classify route conditions
                into sensory levels such as Low or High.
              </p>

            </details>


            <details className="resources-faq-item">

              <summary>
                <span>
                  <CircleHelp size={18} />

                  What happens when sensory data is unavailable?
                </span>

                <span className="resources-faq-plus">
                  +
                </span>
              </summary>

              <p>
                HushWay should clearly tell the user that sensory
                information is unavailable rather than displaying
                unsupported information.
              </p>

            </details>


            <details className="resources-faq-item">

              <summary>
                <span>
                  <CircleHelp size={18} />

                  Does HushWay always choose the fastest route?
                </span>

                <span className="resources-faq-plus">
                  +
                </span>
              </summary>

              <p>
                No. HushWay is designed to help users consider
                calmer or lower-congestion journey options when
                those options are available.
              </p>

            </details>


            <details className="resources-faq-item">

              <summary>
                <span>
                  <CircleHelp size={18} />

                  What is a quiet place?
                </span>

                <span className="resources-faq-plus">
                  +
                </span>
              </summary>

              <p>
                A quiet place is a potential sensory refuge such
                as a park, library or another location that may
                provide a lower-stimulation environment.
              </p>

            </details>


            <details className="resources-faq-item">

              <summary>
                <span>
                  <CircleHelp size={18} />

                  Can community information always be considered accurate?
                </span>

                <span className="resources-faq-plus">
                  +
                </span>
              </summary>

              <p>
                Community updates reflect observations shared by
                users and conditions may change. They should be
                treated as additional travel information rather
                than guaranteed real-time conditions.
              </p>

            </details>

          </div>

        </section>


        {/* =====================================
            PRIVACY / SUPPORT
        ====================================== */}

        <section className="resources-support">

          <div className="resources-support-card">

            <ShieldCheck size={30} />

            <h3>Privacy & Data</h3>

            <p>
              HushWay should collect only information needed
              to provide its features and clearly explain how
              user information is handled.
            </p>

          </div>


          <div className="resources-support-card">

            <TriangleAlert size={30} />

            <h3>Found incorrect information?</h3>

            <p>
              If you notice an incorrect route, sensory indicator
              or quiet place, you can report it to help improve HushWay.
            </p>

            <Link to="/contact">
              Report an issue
              <ArrowRight size={16} />
            </Link>

          </div>

        </section>

      </main>

      <Footer />

    </div>
  )
}