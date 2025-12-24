import { cn } from '../../utils'

interface GridPatternProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  opacity?: number
  fade?: boolean
}

export function GridPattern({
  className,
  size = 'md',
  opacity = 1,
  fade = true
}: GridPatternProps) {
  const sizeClass = size === 'sm' ? 'bg-grid-pattern' : size === 'lg' ? 'bg-grid-pattern-lg' : 'bg-grid-pattern'

  return (
    <div
      className={cn(
        'absolute inset-0 pointer-events-none',
        sizeClass,
        fade && 'mask-gradient',
        className
      )}
      style={{ opacity }}
    >
      {fade && (
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
      )}
    </div>
  )
}
