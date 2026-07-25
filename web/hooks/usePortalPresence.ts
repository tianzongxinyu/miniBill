'use client';

import { useCallback, useEffect, useState, type AnimationEvent } from 'react';

const LEAVE_FALLBACK_MS = 250;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Keeps a portal mounted through CSS leave animation when `open` becomes false. */
export function usePortalPresence(open: boolean) {
  const [hydrated, setHydrated] = useState(false);
  const [present, setPresent] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (open) {
      setPresent(true);
      setLeaving(false);
      return;
    }
    if (!present) return;
    if (prefersReducedMotion()) {
      setPresent(false);
      setLeaving(false);
      return;
    }
    setLeaving(true);
  }, [open, present]);

  useEffect(() => {
    if (!leaving) return;
    const t = window.setTimeout(() => {
      setPresent(false);
      setLeaving(false);
    }, LEAVE_FALLBACK_MS);
    return () => window.clearTimeout(t);
  }, [leaving]);

  const onLeaveEnd = useCallback(
    (e: AnimationEvent<HTMLElement>) => {
      if (!leaving) return;
      if (e.target !== e.currentTarget) return;
      setPresent(false);
      setLeaving(false);
    },
    [leaving]
  );

  return { hydrated, present, leaving, onLeaveEnd };
}
