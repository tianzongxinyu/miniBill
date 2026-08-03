'use client';

import { useEffect, useState } from 'react';
import { fetchRegistrationStatus } from '@/lib/api';

/** Public registration gate; defaults open, stays open on fetch failure. */
export function useRegistrationOpen(defaultOpen = true): boolean | null {
  const [open, setOpen] = useState<boolean | null>(defaultOpen ? true : null);

  useEffect(() => {
    let cancelled = false;
    fetchRegistrationStatus()
      .then((s) => {
        if (!cancelled) setOpen(s.open);
      })
      .catch(() => {
        if (!cancelled) setOpen(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return open;
}
