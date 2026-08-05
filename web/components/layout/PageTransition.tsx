'use client';

import { useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

const NAV_ORDER = ['/', '/transactions/', '/stats/', '/stats/annual/', '/profile/'];
const LAYOUT_CLASS = 'max-w-3xl mx-auto px-2 pt-4 pb-2 lg:px-4 lg:pt-6 lg:pb-3';

function navIndex(pathname: string): number {
  if (pathname === '/') return 0;
  for (let i = NAV_ORDER.length - 1; i >= 1; i--) {
    const base = NAV_ORDER[i].replace(/\/$/, '');
    if (pathname === NAV_ORDER[i] || pathname.startsWith(base + '/')) return i;
  }
  return -1;
}

type SlideDir = 'left' | 'right' | 'none';

function animClassFor(dir: SlideDir): string {
  if (dir === 'right') return 'page-slide-right';
  if (dir === 'left') return 'page-slide-left';
  return 'page-enter';
}

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prev = useRef({ path: pathname, idx: navIndex(pathname) });
  /** Once set to current pathname, animation class is cleared (no residual transform). */
  const [finishedPath, setFinishedPath] = useState<string | null>(null);

  let dir: SlideDir = 'none';
  const currIdx = navIndex(pathname);
  if (prev.current.path !== pathname) {
    const from = prev.current.idx;
    if (from >= 0 && currIdx >= 0 && from !== currIdx) {
      dir = currIdx > from ? 'right' : 'left';
    }
    prev.current = { path: pathname, idx: currIdx };
  }

  const animClass = finishedPath === pathname ? '' : animClassFor(dir);

  return (
    <div
      key={pathname}
      className={`${animClass} ${LAYOUT_CLASS}`.trim()}
      onAnimationEnd={(e) => {
        if (e.target !== e.currentTarget) return;
        setFinishedPath(pathname);
      }}
    >
      {children}
    </div>
  );
}
