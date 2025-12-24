import { cn } from '../../utils'

interface LogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  animated?: boolean
}

export function Logo({ className, size = 'md', animated = true }: LogoProps) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  }

  return (
    <div className={cn('relative flex items-center justify-center', sizeClasses[size], className)}>
      {/* Outer hexagon ring */}
      <svg
        viewBox="0 0 100 100"
        className={cn(
          'absolute inset-0 w-full h-full',
          animated && 'animate-pulse-glow'
        )}
        style={{ filter: 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.4))' }}
      >
        {/* Hexagon path */}
        <path
          d="M50 5 L90 27.5 L90 72.5 L50 95 L10 72.5 L10 27.5 Z"
          fill="none"
          stroke="url(#gradient)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Gradient definition */}
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="1" />
            <stop offset="50%" stopColor="#84cc16" stopOpacity="1" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="1" />
          </linearGradient>
        </defs>
      </svg>

      {/* Inner target/crosshair */}
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 w-full h-full"
      >
        {/* Center dot */}
        <circle cx="50" cy="50" r="8" fill="#06b6d4" />

        {/* Crosshair lines */}
        <line x1="50" y1="30" x2="50" y2="42" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" />
        <line x1="50" y1="58" x2="50" y2="70" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" />
        <line x1="30" y1="50" x2="42" y2="50" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" />
        <line x1="58" y1="50" x2="70" y2="50" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" />

        {/* Corner brackets */}
        <path d="M 25 35 L 25 25 L 35 25" stroke="#84cc16" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M 75 35 L 75 25 L 65 25" stroke="#84cc16" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M 25 65 L 25 75 L 35 75" stroke="#84cc16" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M 75 65 L 75 75 L 65 75" stroke="#84cc16" strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>

      {/* Scan line effect */}
      {animated && (
        <div className="absolute inset-0 overflow-hidden opacity-30">
          <div
            className="absolute w-full h-0.5 bg-gradient-to-r from-transparent via-accent-cyan to-transparent"
            style={{
              animation: 'scan 2s ease-in-out infinite',
            }}
          />
        </div>
      )}
    </div>
  )
}
