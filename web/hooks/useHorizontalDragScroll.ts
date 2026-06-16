'use client';

import { useCallback, useEffect, useRef, type RefObject } from 'react';

const DRAG_THRESHOLD = 4;

type Options = {
  enabled?: boolean;
  /** clientY drives scrollLeft when the scroll container is rotated (portrait fallback). */
  scrollAxis?: 'x' | 'y';
  /** When false, touch uses native overflow scroll; mouse still drags. */
  captureTouch?: boolean;
};

export function useHorizontalDragScroll<T extends HTMLElement>(
  scrollRef: RefObject<T | null>,
  { enabled = true, scrollAxis = 'x', captureTouch = false }: Options = {}
) {
  const dragState = useRef<{
    pointerId: number;
    startCoord: number;
    startScrollLeft: number;
    dragging: boolean;
    raf: number;
    pendingScrollLeft: number | null;
  } | null>(null);

  const flushScroll = useCallback(
    (el: T) => {
      const state = dragState.current;
      if (!state || state.pendingScrollLeft == null) return;
      el.scrollLeft = state.pendingScrollLeft;
      state.pendingScrollLeft = null;
      state.raf = 0;
    },
    []
  );

  const applyDrag = useCallback(
    (coord: number, preventDefault?: () => void) => {
      const state = dragState.current;
      const el = scrollRef.current;
      if (!state || !el) return;

      const dx = coord - state.startCoord;
      if (!state.dragging && Math.abs(dx) < DRAG_THRESHOLD) return;

      if (!state.dragging) {
        state.dragging = true;
        el.classList.add('is-dragging');
        if (state.pointerId >= 0) {
          try {
            el.setPointerCapture(state.pointerId);
          } catch {
            /* ignore */
          }
        }
      }

      preventDefault?.();
      state.pendingScrollLeft = state.startScrollLeft - dx;
      if (!state.raf) {
        state.raf = requestAnimationFrame(() => flushScroll(el));
      }
    },
    [flushScroll, scrollRef]
  );

  const endDrag = useCallback(
    (pointerId?: number) => {
      const state = dragState.current;
      if (!state) return;
      if (pointerId != null && state.pointerId !== pointerId) return;

      const el = scrollRef.current;
      if (state.raf) {
        cancelAnimationFrame(state.raf);
        state.raf = 0;
      }
      if (el && state.pendingScrollLeft != null) {
        el.scrollLeft = state.pendingScrollLeft;
        state.pendingScrollLeft = null;
      }
      if (state.dragging) {
        el?.classList.remove('is-dragging');
        if (state.pointerId >= 0) {
          try {
            el?.releasePointerCapture(state.pointerId);
          } catch {
            /* capture may already be released */
          }
        }
      }
      dragState.current = null;
    },
    [scrollRef]
  );

  const shouldCapturePointer = useCallback(
    (pointerType: string) => captureTouch || pointerType === 'mouse',
    [captureTouch]
  );

  const pointerCoord = useCallback(
    (clientX: number, clientY: number) => (scrollAxis === 'y' ? clientY : clientX),
    [scrollAxis]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled || e.button !== 0) return;
      if (!shouldCapturePointer(e.pointerType)) return;
      const el = scrollRef.current;
      if (!el) return;

      dragState.current = {
        pointerId: e.pointerId,
        startCoord: pointerCoord(e.clientX, e.clientY),
        startScrollLeft: el.scrollLeft,
        dragging: false,
        raf: 0,
        pendingScrollLeft: null,
      };
    },
    [enabled, pointerCoord, scrollRef, shouldCapturePointer]
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!enabled || e.button !== 0) return;
      // Pointer events handle mouse on modern browsers; avoid clobbering pointerId.
      if (dragState.current) return;
      const el = scrollRef.current;
      if (!el) return;

      dragState.current = {
        pointerId: -1,
        startCoord: pointerCoord(e.clientX, e.clientY),
        startScrollLeft: el.scrollLeft,
        dragging: false,
        raf: 0,
        pendingScrollLeft: null,
      };
    },
    [enabled, pointerCoord, scrollRef]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const state = dragState.current;
      if (!state || e.pointerId !== state.pointerId) return;
      applyDrag(pointerCoord(e.clientX, e.clientY), () => e.preventDefault());
    },
    [applyDrag, pointerCoord]
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

  useEffect(() => {
    if (!enabled) return;

    const onMouseMove = (e: MouseEvent) => {
      const state = dragState.current;
      if (!state || state.pointerId >= 0) return;
      applyDrag(pointerCoord(e.clientX, e.clientY), () => e.preventDefault());
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
  }, [enabled, applyDrag, endDrag, pointerCoord]);

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
