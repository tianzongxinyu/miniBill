'use client';

import { useEffect, useLayoutEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useLedgerAccess } from '@/components/LedgerAccessProvider';
import { withFnosSdk } from '@/lib/fnos/sdk';
import { ledgerDocumentTitle } from '@/lib/ledgerDocumentTitle';

/** Last title pushed to fnOS host; skip duplicate setTitle IPC on navigation. */
let lastHostTitle: string | null = null;

/** Keep document.title in sync with locale and active ledger; Next.js resets it on client navigation. */
export function DocumentTitle() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const { t, i18n } = useTranslation();
  const { active, ready, isOwner } = useLedgerAccess();

  const ownerUsername = ready ? active?.username ?? null : null;
  const own = ready && Boolean(active) && isOwner;
  const desired = ledgerDocumentTitle(t('app.name'), {
    ownerUsername,
    isOwn: own,
  });

  useLayoutEffect(() => {
    const apply = () => {
      if (document.title !== desired) document.title = desired;
    };
    apply();
    const titleEl = document.querySelector('title');
    const obs = new MutationObserver(apply);
    if (titleEl) {
      obs.observe(titleEl, { childList: true, characterData: true, subtree: true });
    } else {
      obs.observe(document.head, { childList: true, subtree: true, characterData: true });
    }
    return () => obs.disconnect();
  }, [pathname, searchKey, desired]);

  useEffect(() => {
    if (desired === lastHostTitle) return;
    lastHostTitle = desired;
    void withFnosSdk((sdk) => sdk.setTitle(desired));
  }, [desired]);

  return null;
}
