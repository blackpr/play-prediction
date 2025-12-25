import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { toast } from 'sonner';

interface RefreshContextType {
  isBlocked: boolean;
  blockRefresh: () => void;
  unblockRefresh: () => void;
  setPendingVersion: (version: string) => void;
}

const RefreshContext = createContext<RefreshContextType | null>(null);

export function RefreshProvider({ children }: { children: ReactNode }) {
  // Use a counter instead of a boolean to handle multiple blockers
  const [blockerCount, setBlockerCount] = useState(0);
  const [pendingVersion, setPendingVersion] = useState<string | null>(null);

  const isBlocked = blockerCount > 0;

  const blockRefresh = () => setBlockerCount((c) => c + 1);
  const unblockRefresh = () => setBlockerCount((c) => Math.max(0, c - 1));

  // Handle refresh logic
  useEffect(() => {
    if (!pendingVersion) return;

    if (!isBlocked) {
      // Safe to refresh immediately
      toast.info('New version available. Refreshing...', { duration: 2000 });
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } else {
      // Blocked: Show notification with manual refresh
      toast.info(
        <div className="flex flex-col gap-2">
          <span>New version available!</span>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700 transition-colors"
          >
            Refresh Now
          </button>
        </div>,
        {
          id: 'version-update', // Prevent duplicate toasts
          duration: Infinity, // Stay until dismissed or refreshed
        }
      );
    }
  }, [pendingVersion, isBlocked]);

  return (
    <RefreshContext.Provider
      value={{
        isBlocked,
        blockRefresh,
        unblockRefresh,
        setPendingVersion,
      }}
    >
      {children}
    </RefreshContext.Provider>
  );
}

export function useRefreshContext() {
  const context = useContext(RefreshContext);
  if (!context) {
    throw new Error('useRefreshContext must be used within a RefreshProvider');
  }
  return context;
}
