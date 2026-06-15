'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getScrollY } from '@/lib/scroll';

const THRESHOLD = 64;
const TOP_EPSILON = 2;

export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const pullRef = useRef(0);
  const refreshing = useRef(false);
  const rafRef = useRef(0);

  const publishDistance = useCallback((d: number) => {
    pullRef.current = d;
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      setPullDistance(pullRef.current);
    });
  }, []);

  const resetPull = useCallback(() => {
    if (pullRef.current === 0) return;
    pullRef.current = 0;
    publishDistance(0);
  }, [publishDistance]);

  const handleRefresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    setPulling(true);
    try {
      await onRefresh();
    } finally {
      refreshing.current = false;
      setPulling(false);
      resetPull();
    }
  }, [onRefresh, resetPull]);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (getScrollY() > TOP_EPSILON || refreshing.current) return;
      startY.current = e.touches[0].clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (refreshing.current) return;
      if (getScrollY() > TOP_EPSILON) {
        resetPull();
        return;
      }
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0) {
        publishDistance(Math.min(dy, THRESHOLD * 1.5));
      } else {
        resetPull();
      }
    };

    const onTouchEnd = () => {
      if (pullRef.current >= THRESHOLD && !refreshing.current) {
        void handleRefresh();
      } else {
        resetPull();
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [handleRefresh, publishDistance, resetPull]);

  return { pulling, pullDistance, refresh: handleRefresh };
}
