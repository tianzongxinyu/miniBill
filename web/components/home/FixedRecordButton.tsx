'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';

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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      <div className="fab-wrap pointer-events-none invisible" aria-hidden>
        <div className="fab-glow" />
        <span className="fab-button">
          <PlusIcon />
          <span>记一笔</span>
        </span>
        <span className="fab-button fab-button-secondary">
          <BalanceIcon />
          <span>余额登记</span>
        </span>
      </div>
      {mounted &&
        createPortal(
          <div className="fab-wrap">
            <div className="fab-glow" aria-hidden />
            <Link href="/add/" className="fab-button">
              <PlusIcon />
              <span>记一笔</span>
            </Link>
            <Link href="/balance/?returnTo=/" className="fab-button fab-button-secondary">
              <BalanceIcon />
              <span>余额登记</span>
            </Link>
          </div>,
          document.body
        )}
    </>
  );
}
