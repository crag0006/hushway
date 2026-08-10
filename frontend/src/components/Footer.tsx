import { Flower2, Instagram, Youtube, Linkedin } from 'lucide-react'
import './Footer.css'

const columns = [
  {
    title: 'Use cases',
    links: [
      'Daily commute planning',
      'Avoiding crowded streets',
      'Finding quiet places',
      'Emergency calm route',
      'Predictive crowd alerts',
      'Sensory-friendly travel',
      'Sunflower Community',
    ],
  },
  {
    title: 'Explore',
    links: [
      'SDG 11: Inclusive Cities',
      'Sensory-Friendly Routes',
      'Real-time Crowd Data',
      'Neurodivergent Support',
      'Accessible Design',
      'Accessibility Statement',
      'FAQs',
    ],
  },
  {
    title: 'Resources',
    links: [
      'Open Data Sources',
      'Privacy Policy',
      'Colors',
      'Report an Issue',
      'Support',
      'Developers',
      'Resource library',
    ],
  },
]

// Simple X (Twitter) icon since lucide's may vary
function XIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

export default function Footer() {
  return (
    <footer className="hw-footer">
      <div className="hw-footer__inner">
        <div className="hw-footer__brand-col">
          <div className="hw-footer__brand">
            <Flower2 size={30} strokeWidth={2.2} />
            <span>HushWay</span>
          </div>
          <div className="hw-footer__socials" aria-label="Social links">
            <a href="#" aria-label="X"><XIcon /></a>
            <a href="#" aria-label="Instagram"><Instagram size={20} /></a>
            <a href="#" aria-label="YouTube"><Youtube size={22} /></a>
            <a href="#" aria-label="LinkedIn"><Linkedin size={20} /></a>
          </div>
        </div>

        {columns.map((col) => (
          <div key={col.title} className="hw-footer__col">
            <h4>{col.title}</h4>
            <ul>
              {col.links.map((l) => (
                <li key={l}><a href="#">{l}</a></li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="hw-footer__legal">
        © 2026 HushWay. Built for Monash FIT5120 Studio
      </div>
    </footer>
  )
}
