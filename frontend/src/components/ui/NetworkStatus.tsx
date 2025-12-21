import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { cn } from '../../utils';

export function NetworkStatus() {
  const isOnline = useNetworkStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div className={cn(
      "fixed top-0 left-0 right-0 z-[100]",
      "bg-red-600 text-white text-center py-2 px-4 shadow-md",
      "flex items-center justify-center gap-2 font-medium text-sm transition-transform duration-300"
    )}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="lucide lucide-wifi-off"
      >
        <path d="M2 12h20" />
        <path d="M5 2l5 5" />
        <path d="M4 2L2 4" />
        <path d="M22 2l-2 2" />
        <path d="M19 2l5 5" />
      </svg>
      <span>You are currently offline. Some features may be unavailable.</span>
    </div>
  );
}
