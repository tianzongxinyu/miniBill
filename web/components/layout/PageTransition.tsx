'use client';

import { useRef } from 'react';
import { usePathname } from 'next/navigation';

const NAV_ORDER = ['/', '/transactions/', '/stats/', '/stats/annual/', '/profile/'];

function navIndex(pathname: string): number {
  if (pathname === '/') return 0;
  for (let i = NAV_ORDER.length - 1; i >= 1; i--) {
    const base = NAV_ORDER[i].replace(/\/$/, '');
    if (pathname === NAV_ORDER[i] || pathname.startsWith(base + '/')) return i;
  }
  return -1;
}

type SlideDir = 'left' | 'right' | 'none';

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prev = useRef({ path: pathname, idx: navIndex(pathname) });

  let dir: SlideDir = 'none';
  const currIdx = navIndex(pathname);
  if (prev.current.path !== pathname) {
    const from = prev.current.idx;
    if (from >= 0 && currIdx >= 0 && from !== currIdx) {
      dir = currIdx > from ? 'right' : 'left';
    }
    prev.current = { path: pathname, idx: currIdx };
  }

  const cls =
    dir === 'right' ? 'page-slide-right' : dir === 'left' ? 'page-slide-left' : 'page-enter';

  return (
    <div key={pathname} className={`${cls} max-w-3xl mx-auto px-2 pt-4 pb-2 lg:px-4 lg:pt-6 lg:pb-3`}>
      {children}
    </div>
  );
}
