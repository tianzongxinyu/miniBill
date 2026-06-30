'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

function BalanceIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3v18M7 8h10M7 16h10" strokeLinecap="round" />
    </svg>
  );
}

export function FixedRecordButton() {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      <div className="fab-wrap pointer-events-none invisible" aria-hidden>
        <div className="fab-inner">
          <div className="fab-buttons">
            <div className="fab-glow" />
            <span className="fab-button">
              <PlusIcon />
              <span>{t('add.createTitle')}</span>
            </span>
            <span className="fab-button fab-button-secondary">
              <BalanceIcon />
              <span>{t('balance.registerButton')}</span>
            </span>
          </div>
        </div>
      </div>
      {mounted &&
        createPortal(
          <div className="fab-wrap">
            <div className="fab-inner">
              <div className="fab-buttons">
                <div className="fab-glow" aria-hidden />
                <Link href="/add/?returnTo=/" className="fab-button">
                  <PlusIcon />
                  <span>{t('add.createTitle')}</span>
                </Link>
                <Link href="/balance/?returnTo=/" className="fab-button fab-button-secondary">
                  <BalanceIcon />
                  <span>{t('balance.registerButton')}</span>
                </Link>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
