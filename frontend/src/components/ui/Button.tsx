import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '../../utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'yes' | 'no'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={props.disabled || isLoading}
        className={cn(
          'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
          {
            'bg-primary text-white hover:bg-primary/90': variant === 'primary',
            'bg-secondary text-white hover:bg-secondary/90':
              variant === 'secondary',
            'hover:bg-surface-highlight text-text': variant === 'ghost',
            'bg-no text-white hover:bg-no/90':
              variant === 'danger' || variant === 'no',
            'bg-yes text-white hover:bg-yes/90': variant === 'yes',
            'h-8 px-3 text-sm': size === 'sm',
            'h-10 px-4 py-2': size === 'md',
            'h-12 px-8 text-lg': size === 'lg',
          },
          className,
        )}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : leftIcon ? (
          <span className="mr-2 flex items-center">{leftIcon}</span>
        ) : null}
        {children}
        {rightIcon && !isLoading && (
          <span className="ml-2 flex items-center">{rightIcon}</span>
        )}
      </button>
    )
  },
)
Button.displayName = 'Button'
