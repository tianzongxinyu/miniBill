'use client';

import { useCallback, useEffect, useRef, type RefObject } from 'react';

const DRAG_THRESHOLD = 5;

type Options = {
  enabled?: boolean;
};

export function useHorizontalDragScroll<T extends HTMLElement>(
  scrollRef: RefObject<T | null>,
  { enabled = true }: Options = {}
) {
  const dragState = useRef<{
    startX: number;
    startScrollLeft: number;
    dragging: boolean;
  } | null>(null);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!enabled || e.button !== 0) return;
      const el = scrollRef.current;
      if (!el) return;
      dragState.current = {
        startX: e.clientX,
        startScrollLeft: el.scrollLeft,
        dragging: false,
      };
    },
    [enabled, scrollRef]
  );

  useEffect(() => {
    if (!enabled) return;

    const onMouseMove = (e: MouseEvent) => {
      const state = dragState.current;
      const el = scrollRef.current;
      if (!state || !el) return;

      const dx = e.clientX - state.startX;
      if (!state.dragging && Math.abs(dx) < DRAG_THRESHOLD) return;

      if (!state.dragging) {
        state.dragging = true;
        el.classList.add('is-dragging');
      }

      e.preventDefault();
      el.scrollLeft = state.startScrollLeft - dx;
    };

    const onMouseUp = () => {
      const el = scrollRef.current;
      if (dragState.current?.dragging) {
        el?.classList.remove('is-dragging');
      }
      dragState.current = null;
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [enabled, scrollRef]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !enabled) return;

    const onWheel = (e: WheelEvent) => {
      const delta =
        Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0;
      if (delta === 0) return;
      e.preventDefault();
      el.scrollLeft += delta;
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [enabled, scrollRef]);

  return { onMouseDown };
}
