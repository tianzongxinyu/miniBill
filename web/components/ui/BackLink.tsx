'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';

export function PageBackLink({ href }: { href: string }) {
  const { t } = useTranslation();
  return (
    <Link href={href} className="page-back-link">
      {t('common.back')}
    </Link>
  );
}

export function PageFooterActions({ children }: { children: React.ReactNode }) {
  return <div className="page-footer-actions">{children}</div>;
}
