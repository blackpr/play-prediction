import { Loader2 } from "lucide-react"
import { cn } from "../../utils"

interface SpinnerProps {
  className?: string;
  size?: number;
}

export function Spinner({ className, size = 24 }: SpinnerProps) {
  return (
    <Loader2 
      className={cn("animate-spin text-primary", className)} 
      size={size}
    />
  )
}
