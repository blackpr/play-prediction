import { useEffect } from 'react';
import { useRefreshContext } from '../providers/refresh-context';

export function useRefreshBlocker(shouldBlock: boolean) {
  const { blockRefresh, unblockRefresh } = useRefreshContext();

  useEffect(() => {
    if (shouldBlock) {
      blockRefresh();
      return () => {
        unblockRefresh();
      };
    }
  }, [shouldBlock, blockRefresh, unblockRefresh]);
}
