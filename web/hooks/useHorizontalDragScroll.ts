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
    pointerId: number;
    startX: number;
    startScrollLeft: number;
    dragging: boolean;
  } | null>(null);

  const applyDrag = useCallback(
    (clientX: number, preventDefault?: () => void) => {
      const state = dragState.current;
      const el = scrollRef.current;
      if (!state || !el) return;

      const dx = clientX - state.startX;
      if (!state.dragging && Math.abs(dx) < DRAG_THRESHOLD) return;

      if (!state.dragging) {
        state.dragging = true;
        el.classList.add('is-dragging');
      }

      preventDefault?.();
      el.scrollLeft = state.startScrollLeft - dx;
    },
    [scrollRef]
  );

  const endDrag = useCallback(
    (pointerId?: number) => {
      const state = dragState.current;
      if (!state) return;
      if (pointerId != null && state.pointerId !== pointerId) return;

      const el = scrollRef.current;
      if (state.dragging) {
        el?.classList.remove('is-dragging');
        el?.releasePointerCapture?.(state.pointerId);
      }
      dragState.current = null;
    },
    [scrollRef]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled || e.button !== 0) return;
      const el = scrollRef.current;
      if (!el) return;

      dragState.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startScrollLeft: el.scrollLeft,
        dragging: false,
      };
      el.setPointerCapture(e.pointerId);
    },
    [enabled, scrollRef]
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!enabled || e.button !== 0) return;
      const el = scrollRef.current;
      if (!el) return;

      dragState.current = {
        pointerId: -1,
        startX: e.clientX,
        startScrollLeft: el.scrollLeft,
        dragging: false,
      };
    },
    [enabled, scrollRef]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const state = dragState.current;
      if (!state || e.pointerId !== state.pointerId) return;
      applyDrag(e.clientX, () => e.preventDefault());
    },
    [applyDrag]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      endDrag(e.pointerId);
    },
    [endDrag]
  );

  const onPointerCancel = useCallback(
    (e: React.PointerEvent) => {
      endDrag(e.pointerId);
    },
    [endDrag]
  );

  // Legacy mouse path for environments without pointer capture.
  useEffect(() => {
    if (!enabled) return;

    const onMouseMove = (e: MouseEvent) => {
      const state = dragState.current;
      if (!state || state.pointerId >= 0) return;
      applyDrag(e.clientX, () => e.preventDefault());
    };

    const onMouseUp = () => {
      endDrag(-1);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [enabled, applyDrag, endDrag]);

  useEffect(() => {
    if (!enabled) return;

    let el = scrollRef.current;
    let raf = 0;
    let boundEl: T | null = null;

    const onWheel = (e: WheelEvent) => {
      const delta =
        Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0;
      if (delta === 0) return;
      e.preventDefault();
      (e.currentTarget as HTMLElement).scrollLeft += delta;
    };

    const bind = () => {
      el = scrollRef.current;
      if (!el) {
        raf = requestAnimationFrame(bind);
        return;
      }
      if (boundEl === el) return;
      boundEl?.removeEventListener('wheel', onWheel);
      el.addEventListener('wheel', onWheel, { passive: false });
      boundEl = el;
    };

    bind();

    return () => {
      cancelAnimationFrame(raf);
      boundEl?.removeEventListener('wheel', onWheel);
    };
  }, [enabled, scrollRef]);

  return {
    onMouseDown,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  };
}
