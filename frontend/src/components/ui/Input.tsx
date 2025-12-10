import * as React from "react"
import { cn } from "../../utils"

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-text-muted">
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={cn(
            "flex h-10 w-full rounded-md border border-surface-highlight bg-surface px-3 py-2 text-sm text-text placeholder:text-text-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-no focus-visible:ring-no",
            className
          )}
          {...props}
        />
        {hint && !error && <p className="text-xs text-text-dim">{hint}</p>}
        {error && <p className="text-xs text-no">{error}</p>}
      </div>
    )
  }
)
Input.displayName = "Input"
