import * as React from "react"
import { X } from "lucide-react"
import { cn } from "../../utils"
import { Button } from "./Button"

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div 
        className={cn(
          "relative w-full max-w-lg rounded-xl bg-surface p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200",
          className
        )}
      >
        <div className="flex items-center justify-between mb-4">
          {title && <h2 className="text-xl font-semibold text-text">{title}</h2>}
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X size={20} />
          </Button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  )
}
