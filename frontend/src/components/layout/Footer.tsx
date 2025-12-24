import { Link } from '@tanstack/react-router'
import { memo } from 'react'
import { Github, MessageCircle, Twitter } from 'lucide-react'
import { GridPattern } from '../ui/GridPattern'
import { Logo } from '../ui/Logo'

export const Footer = memo(function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="relative bg-surface border-t border-surface-highlight py-12 mt-auto overflow-hidden">
      <GridPattern className="opacity-5" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Logo & Tagline */}
          <div className="space-y-4">
            <Link
              to="/"
              search={{ page: 1, pageSize: 20, sort: 'createdAt', order: 'desc' }}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity group"
            >
              <Logo size="md" animated={false} />
              <span className="font-display text-xl font-bold text-text">
                Play <span className="text-gradient-cyan">Prediction</span>
              </span>
            </Link>
            <p className="text-text-muted text-sm leading-relaxed">
              Binary prediction markets powered by algorithmic pricing and instant liquidity.
            </p>
          </div>

          {/* Platform */}
          <div>
            <h3 className="font-mono text-accent-cyan uppercase tracking-wider text-xs font-bold mb-4">
              Platform
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link
                  to="/"
                  search={{ page: 1, pageSize: 20, sort: 'createdAt', order: 'desc' }}
                  className="text-text-muted hover:text-accent-cyan transition-colors inline-flex items-center gap-2"
                >
                  <span className="text-accent-cyan">▸</span>
                  Markets
                </Link>
              </li>
              <li>
                <Link
                  to="/about"
                  className="text-text-muted hover:text-accent-cyan transition-colors inline-flex items-center gap-2"
                >
                  <span className="text-accent-cyan">▸</span>
                  About
                </Link>
              </li>
              <li>
                <Link
                  to="/portfolio"
                  className="text-text-muted hover:text-accent-cyan transition-colors inline-flex items-center gap-2"
                >
                  <span className="text-accent-cyan">▸</span>
                  Portfolio
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="font-mono text-accent-cyan uppercase tracking-wider text-xs font-bold mb-4">
              Resources
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <a
                  href="https://github.com/yourusername/play-prediction"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-text-muted hover:text-accent-cyan transition-colors inline-flex items-center gap-2"
                >
                  <span className="text-accent-cyan">▸</span>
                  Documentation
                </a>
              </li>
              <li>
                <span className="text-text-dim cursor-not-allowed inline-flex items-center gap-2">
                  <span className="text-text-dim">▸</span>
                  Terms of Service
                </span>
              </li>
              <li>
                <span className="text-text-dim cursor-not-allowed inline-flex items-center gap-2">
                  <span className="text-text-dim">▸</span>
                  Privacy Policy
                </span>
              </li>
            </ul>
          </div>

          {/* Connect */}
          <div>
            <h3 className="font-mono text-accent-cyan uppercase tracking-wider text-xs font-bold mb-4">
              Connect
            </h3>
            <div className="flex flex-col gap-3">
              <a
                href="#"
                className="text-text-muted hover:text-accent-cyan transition-colors inline-flex items-center gap-2 text-sm"
                aria-label="GitHub"
                onClick={(e) => e.preventDefault()}
              >
                <Github className="w-4 h-4" />
                GitHub
              </a>
              <a
                href="#"
                className="text-text-muted hover:text-accent-cyan transition-colors inline-flex items-center gap-2 text-sm"
                aria-label="Twitter"
                onClick={(e) => e.preventDefault()}
              >
                <Twitter className="w-4 h-4" />
                Twitter
              </a>
              <a
                href="#"
                className="text-text-muted hover:text-accent-cyan transition-colors inline-flex items-center gap-2 text-sm"
                aria-label="Discord"
                onClick={(e) => e.preventDefault()}
              >
                <MessageCircle className="w-4 h-4" />
                Discord
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-surface-highlight pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm">
            <p className="text-text-muted font-mono">
              © {currentYear} Play Prediction. <span className="text-text-dim">All rights reserved.</span>
            </p>
            <p className="text-text-dim font-mono text-xs">
              Built with <span className="text-accent-cyan">♥</span> for prediction markets
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
})
