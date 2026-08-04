'use client';

import { useEffect, useState } from 'react';
import { getFnosSdk, withFnosSdk } from '@/lib/fnos/sdk';

/** True after TrimApp initializes successfully (false on Docker / plain browser). */
export function useFnosReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void getFnosSdk().then((sdk) => {
      if (!cancelled) setReady(Boolean(sdk));
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return ready;
}

export function openFnosAppSetting() {
  return withFnosSdk((sdk) => sdk.openAppSetting());
}
