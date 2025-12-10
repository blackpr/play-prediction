import * as React from "react"
import { cn } from "../../utils"

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'outlined';
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-xl p-6",
          {
            'bg-surface': variant === 'default',
            'bg-surface-highlight shadow-lg': variant === 'elevated',
            'border border-surface-highlight bg-transparent': variant === 'outlined',
          },
          className
        )}
        {...props}
      />
    )
  }
)
Card.displayName = "Card"
