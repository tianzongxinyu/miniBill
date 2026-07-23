'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';

export function PageBackLink({
  href,
  floating = false,
}: {
  href: string;
  floating?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Link
      href={href}
      className={floating ? 'page-back-link page-back-link-floating' : 'page-back-link'}
    >
      {t('common.back')}
    </Link>
  );
}

export function PageFooterActions({ children }: { children: React.ReactNode }) {
  return <div className="page-footer-actions">{children}</div>;
}
