'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getScrollY } from '@/lib/scroll';

const THRESHOLD = 64;

export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const pullRef = useRef(0);
  const refreshing = useRef(false);

  const handleRefresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    setPulling(true);
    try {
      await onRefresh();
    } finally {
      refreshing.current = false;
      setPulling(false);
      setPullDistance(0);
      pullRef.current = 0;
    }
  }, [onRefresh]);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (getScrollY() > 0 || refreshing.current) return;
      startY.current = e.touches[0].clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (getScrollY() > 0 || refreshing.current) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0) {
        const d = Math.min(dy, THRESHOLD * 1.5);
        pullRef.current = d;
        setPullDistance(d);
      }
    };

    const onTouchEnd = () => {
      if (pullRef.current >= THRESHOLD && !refreshing.current) {
        void handleRefresh();
      } else {
        pullRef.current = 0;
        setPullDistance(0);
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [handleRefresh]);

  return { pulling, pullDistance, refresh: handleRefresh };
}
