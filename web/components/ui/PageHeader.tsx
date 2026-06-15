'use client';

import { useRef } from 'react';

export { scrollToTop } from '@/lib/scroll';

export function PageHeader({
  title,
  subtitle,
  action,
  sticky,
  onTitleDoubleClick,
  doubleClickHint = '双击回到顶部',
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  sticky?: boolean;
  onTitleDoubleClick?: () => void;
  doubleClickHint?: string;
}) {
  const lastTapRef = useRef(0);

  const handleScrollTop = () => {
    onTitleDoubleClick?.();
  };

  const handleTouchEnd = () => {
    if (!onTitleDoubleClick) return;
    const now = Date.now();
    if (now - lastTapRef.current < 350) {
      lastTapRef.current = 0;
      onTitleDoubleClick();
    } else {
      lastTapRef.current = now;
    }
  };

  const interactive = Boolean(onTitleDoubleClick);

  return (
    <div
      className={`flex items-start justify-between gap-3 mb-4 ${
        sticky
          ? 'sticky top-0 z-30 -mx-4 px-4 py-2.5 lg:-mx-8 lg:px-8 -mt-4 pt-4 lg:-mt-6 lg:pt-6 bg-canvas/90 backdrop-blur-xl border-b border-line/40'
          : ''
      }`}
    >
      <div
        className={`min-w-0 flex-1 ${interactive ? 'cursor-pointer select-none' : ''}`}
        onDoubleClick={interactive ? handleScrollTop : undefined}
        onTouchEnd={interactive ? handleTouchEnd : undefined}
        title={interactive ? doubleClickHint : undefined}
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        onKeyDown={
          interactive
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleScrollTop();
                }
              }
            : undefined
        }
      >
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
