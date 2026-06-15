'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  compareYearMonth,
  prevMonth,
  type YearMonth,
} from '@/lib/api';
import { getScrollY, isNearPageBottom } from '@/lib/scroll';

const PULL_DEBOUNCE_MS = 450;
const LOAD_SETTLE_MS = 900;

// 跨月切换：当月全部加载完后，第一次 overscroll 仅提示「已到底」；第二次才弹 ConfirmDialog。
// markLoadSettling 在分页开始/结束后延长冷却，避免加载完成瞬间误触发弹窗。

type UseTransactionsMonthNavOptions = {
  year: number;
  month: number;
  monthFullyLoaded: boolean;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  earliest: YearMonth | null;
  onGoPrevMonth: () => void;
  onLoadSettling?: () => void;
  enabled?: boolean;
};

export function useTransactionsMonthNav({
  year,
  month,
  monthFullyLoaded,
  loading,
  loadingMore,
  hasMore,
  earliest,
  onGoPrevMonth,
  onLoadSettling,
  enabled = true,
}: UseTransactionsMonthNavOptions) {
  const [atBottom, setAtBottom] = useState(false);
  const [prevMonthDialogOpen, setPrevMonthDialogOpen] = useState(false);

  const bottomAcknowledgedRef = useRef(false);
  const lastPullAtRef = useRef(0);
  const loadSettleUntilRef = useRef(0);
  const prevMonthPromptKeyRef = useRef<string | null>(null);
  const blockAutoPaginationRef = useRef(true);

  const loadingRef = useRef(loading);
  const loadingMoreRef = useRef(loadingMore);
  const hasMoreRef = useRef(hasMore);
  const atBottomRef = useRef(atBottom);
  const prevMonthDialogOpenRef = useRef(prevMonthDialogOpen);
  const earliestRef = useRef(earliest);
  const onGoPrevMonthRef = useRef(onGoPrevMonth);

  loadingRef.current = loading;
  loadingMoreRef.current = loadingMore;
  hasMoreRef.current = hasMore;
  atBottomRef.current = atBottom;
  prevMonthDialogOpenRef.current = prevMonthDialogOpen;
  earliestRef.current = earliest;
  onGoPrevMonthRef.current = onGoPrevMonth;

  const isMonthFullyLoaded = () =>
    !loadingRef.current && !loadingMoreRef.current && !hasMoreRef.current;

  const resetBottomPullState = useCallback(() => {
    bottomAcknowledgedRef.current = false;
    lastPullAtRef.current = 0;
    setAtBottom(false);
  }, []);

  const markLoadSettling = useCallback(() => {
    loadSettleUntilRef.current = Date.now() + LOAD_SETTLE_MS;
    resetBottomPullState();
    onLoadSettling?.();
  }, [resetBottomPullState, onLoadSettling]);

  const resetAll = useCallback(() => {
    blockAutoPaginationRef.current = true;
    prevMonthPromptKeyRef.current = null;
    setPrevMonthDialogOpen(false);
    resetBottomPullState();
  }, [resetBottomPullState]);

  const canGoPrevMonth = useCallback(() => {
    const e = earliestRef.current;
    if (!e) return true;
    return compareYearMonth(prevMonth(year, month), e) >= 0;
  }, [year, month]);

  const openPrevMonthPrompt = useCallback(() => {
    if (
      !canGoPrevMonth() ||
      prevMonthDialogOpenRef.current ||
      loadingRef.current ||
      loadingMoreRef.current ||
      hasMoreRef.current
    ) {
      return;
    }
    const promptKey = `${year}-${month}`;
    if (prevMonthPromptKeyRef.current === promptKey) return;
    prevMonthPromptKeyRef.current = promptKey;
    blockAutoPaginationRef.current = true;
    setPrevMonthDialogOpen(true);
  }, [canGoPrevMonth, year, month]);

  const openPrevMonthPromptRef = useRef(openPrevMonthPrompt);
  openPrevMonthPromptRef.current = openPrevMonthPrompt;

  const handlePullDownWhenExhaustedRef = useRef<() => void>(() => {});
  handlePullDownWhenExhaustedRef.current = () => {
    if (
      !isMonthFullyLoaded() ||
      !canGoPrevMonth() ||
      prevMonthDialogOpenRef.current ||
      !isNearPageBottom() ||
      Date.now() < loadSettleUntilRef.current
    ) {
      return;
    }
    const now = Date.now();
    if (now - lastPullAtRef.current < PULL_DEBOUNCE_MS) return;
    lastPullAtRef.current = now;

    if (!bottomAcknowledgedRef.current) {
      bottomAcknowledgedRef.current = true;
      setAtBottom(true);
      return;
    }
    openPrevMonthPromptRef.current();
  };

  const tryOverscrollPullRef = useRef<(deltaY: number) => void>(() => {});
  tryOverscrollPullRef.current = (deltaY: number) => {
    if (deltaY <= 0) return;
    if (Date.now() < loadSettleUntilRef.current) return;
    if (!isMonthFullyLoaded() || !isNearPageBottom()) return;

    const scrollBefore = getScrollY();
    requestAnimationFrame(() => {
      if (getScrollY() !== scrollBefore) return;
      handlePullDownWhenExhaustedRef.current();
    });
  };

  const markBottomFromScrollRef = useRef<() => void>(() => {});
  markBottomFromScrollRef.current = () => {
    if (hasMoreRef.current || loadingRef.current || loadingMoreRef.current) {
      if (bottomAcknowledgedRef.current || atBottomRef.current) {
        resetBottomPullState();
      }
    }
  };

  useEffect(() => {
    if (!enabled) return;

    let touchStartY = 0;
    let touchStartScrollY = 0;
    let touchPullHandled = false;

    const onWheel = (e: WheelEvent) => {
      blockAutoPaginationRef.current = false;
      tryOverscrollPullRef.current(e.deltaY);
    };

    const onTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0]?.clientY ?? 0;
      touchStartScrollY = getScrollY();
      touchPullHandled = false;
    };

    const onTouchMove = () => {
      blockAutoPaginationRef.current = false;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (touchPullHandled) return;
      const y = e.changedTouches[0]?.clientY ?? touchStartY;
      const pulledUp = touchStartY - y > 48;
      if (!pulledUp) return;
      touchPullHandled = true;
      if (getScrollY() > touchStartScrollY + 4) return;
      tryOverscrollPullRef.current(1);
    };

    const onScroll = () => {
      markBottomFromScrollRef.current();
    };

    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    const main = document.querySelector('main');
    main?.addEventListener('wheel', onWheel, { passive: true });
    main?.addEventListener('touchstart', onTouchStart, { passive: true });
    main?.addEventListener('touchmove', onTouchMove, { passive: true });
    main?.addEventListener('touchend', onTouchEnd, { passive: true });
    main?.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('scroll', onScroll);
      main?.removeEventListener('wheel', onWheel);
      main?.removeEventListener('touchstart', onTouchStart);
      main?.removeEventListener('touchmove', onTouchMove);
      main?.removeEventListener('touchend', onTouchEnd);
      main?.removeEventListener('scroll', onScroll);
    };
  }, [enabled]);

  const confirmGoPrevMonth = useCallback(() => {
    setPrevMonthDialogOpen(false);
    onGoPrevMonthRef.current();
  }, []);

  const cancelGoPrevMonth = useCallback(() => {
    setPrevMonthDialogOpen(false);
    bottomAcknowledgedRef.current = true;
    setAtBottom(true);
    prevMonthPromptKeyRef.current = null;
    lastPullAtRef.current = 0;
  }, []);

  const canPromptPrevMonth = canGoPrevMonth();

  return {
    atBottom,
    prevMonthDialogOpen,
    canPromptPrevMonth,
    markLoadSettling,
    resetAll,
    confirmGoPrevMonth,
    cancelGoPrevMonth,
    blockAutoPaginationRef,
  };
}

export function getTransactionsFooterText(opts: {
  loadingMore: boolean;
  prevMonthDialogOpen: boolean;
  monthFullyLoaded: boolean;
  atBottom: boolean;
  canPromptPrevMonth: boolean;
}): string {
  const { loadingMore, prevMonthDialogOpen, monthFullyLoaded, atBottom } = opts;
  if (loadingMore) return '加载中…';
  if (prevMonthDialogOpen) return '';
  if (monthFullyLoaded && atBottom) return '— 已到底 —';
  return '';
}
