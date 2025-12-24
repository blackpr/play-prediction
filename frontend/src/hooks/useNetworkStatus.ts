import { useSyncExternalStore } from 'react';

/**
 * Hook to track the network connectivity status.
 * Returns true if the browser is online, false if offline.
 */
export function useNetworkStatus(): boolean {
  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );
}

function getSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  return true; // Always assume online on the server
}

function subscribe(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}
