'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { getFloatingRoot } from '@/lib/floatingRoot';

export function PageBackLink({
  href,
  floating = false,
}: {
  href: string;
  floating?: boolean;
}) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const label = t('common.back');

  useEffect(() => {
    if (floating) setMounted(true);
  }, [floating]);

  if (!floating) {
    return (
      <Link href={href} className="page-back-link">
        {label}
      </Link>
    );
  }

  return (
    <>
      <Link
        href={href}
        className="page-back-link page-back-link-floating pointer-events-none invisible"
        aria-hidden
        tabIndex={-1}
      >
        <span>{label}</span>
      </Link>
      {mounted &&
        createPortal(
          <Link href={href} className="page-back-link page-back-link-floating">
            <span>{label}</span>
          </Link>,
          getFloatingRoot()
        )}
    </>
  );
}

export function PageFooterActions({ children }: { children: React.ReactNode }) {
  return <div className="page-footer-actions">{children}</div>;
}
