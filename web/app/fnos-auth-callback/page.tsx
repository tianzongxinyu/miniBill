'use client';

import { useEffect } from 'react';
import { getFnosSdk } from '@/lib/fnos/sdk';
import { FNOS_AUTH_MESSAGE_TYPE } from '@/lib/fnos/auth';

/** Standalone callback for openAppAuth when isStandaloneWeb. */
export default function FnosAuthCallbackPage() {
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let result: unknown = { status: 'error', error: 'access_denied' };
      try {
        const sdk = await getFnosSdk();
        if (sdk) {
          result = sdk.parseAppAuthCallback(window.location.href);
        }
      } catch {
        /* keep error result */
      }
      if (cancelled) return;
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(
          { type: FNOS_AUTH_MESSAGE_TYPE, result },
          window.location.origin
        );
      }
      try {
        window.close();
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="p-6 text-sm text-muted">
      Completing authorization…
    </main>
  );
}
