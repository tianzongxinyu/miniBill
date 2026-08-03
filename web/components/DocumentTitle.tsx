'use client';

import { useLayoutEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useLedgerAccess } from '@/components/LedgerAccessProvider';
import { ledgerDocumentTitle } from '@/lib/ledgerDocumentTitle';

/** Keep document.title in sync with locale and active ledger; Next.js resets it on client navigation. */
export function DocumentTitle() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const { t, i18n } = useTranslation();
  const { active, ready, isOwner } = useLedgerAccess();

  useLayoutEffect(() => {
    const ownerUsername = ready ? active?.username ?? null : null;
    const own = ready && Boolean(active) && isOwner;
    const desired = ledgerDocumentTitle(t('app.name'), {
      ownerUsername,
      isOwn: own,
      ownLabel: t('profile.myLedger'),
      otherLabel: ownerUsername
        ? t('app.titleOtherLedger', { name: ownerUsername })
        : undefined,
    });
    const apply = () => {
      if (document.title !== desired) document.title = desired;
    };
    apply();
    const obs = new MutationObserver(apply);
    obs.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => obs.disconnect();
  }, [pathname, searchKey, t, i18n.language, active?.username, ready, isOwner]);

  return null;
}
