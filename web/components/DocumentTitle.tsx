'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';

/** Keep document.title in sync with locale; Next.js resets it on client navigation. */
export function DocumentTitle() {
  const pathname = usePathname();
  const { t, i18n } = useTranslation();

  useEffect(() => {
    document.title = t('app.name');
  }, [pathname, t, i18n.language]);

  return null;
}
