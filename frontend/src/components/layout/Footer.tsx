import { Link } from '@tanstack/react-router'
import { memo } from 'react'

export const Footer = memo(function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-surface border-t border-surface-highlight py-12 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Logo & Tagline */}
          <div className="space-y-4">
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <span className="text-2xl" role="img" aria-label="logo">
                🎯
              </span>
              <span className="text-xl font-bold text-text">Play Prediction</span>
            </Link>
            <p className="text-text-muted text-sm">
              Predict the future. Trade your knowledge.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="font-semibold text-text mb-4">Platform</h3>
            <ul className="space-y-2 text-sm text-text-muted">
              <li>
                <Link to="/markets" className="hover:text-primary transition-colors">
                  Markets
                </Link>
              </li>
              <li>
                <Link to="/portfolio" className="hover:text-primary transition-colors">
                  Portfolio
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal / Company (Placeholder) */}
          <div>
            <h3 className="font-semibold text-text mb-4">Company</h3>
            <ul className="space-y-2 text-sm text-text-muted">
              <li>
                <span className="cursor-not-allowed opacity-50">About Us</span>
              </li>
              <li>
                <span className="cursor-not-allowed opacity-50">Terms of Service</span>
              </li>
              <li>
                <span className="cursor-not-allowed opacity-50">Privacy Policy</span>
              </li>
            </ul>
          </div>

          {/* Socials (Placeholder) */}
          <div>
            <h3 className="font-semibold text-text mb-4">Connect</h3>
            <div className="flex gap-4">
              <a
                href="#"
                className="text-text-muted hover:text-primary transition-colors"
                aria-label="Twitter"
                onClick={(e) => e.preventDefault()}
              >
                Twitter
              </a>
              <a
                href="#"
                className="text-text-muted hover:text-primary transition-colors"
                aria-label="GitHub"
                onClick={(e) => e.preventDefault()}
              >
                GitHub
              </a>
              <a
                href="#"
                className="text-text-muted hover:text-primary transition-colors"
                aria-label="Discord"
                onClick={(e) => e.preventDefault()}
              >
                Discord
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-surface-highlight mt-8 pt-8 text-center text-sm text-text-muted flex flex-col md:flex-row justify-between items-center gap-4">
          <p>&copy; {currentYear} Play Prediction. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
})
