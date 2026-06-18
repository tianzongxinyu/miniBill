'use client';

import { createPortal } from 'react-dom';
import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { useComboboxFloatingDropdown } from '@/hooks/useComboboxFloatingDropdown';

type FloatingPickerPortalProps = {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  panelRef?: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  children: ReactNode;
  panelClassName?: string;
  bodyClassName?: string;
  role?: string;
  'aria-label'?: string;
  widthMode?: 'content' | 'page';
};

function FloatingPickerClose({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className="combobox-floating-close"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      aria-label={t('common.close')}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
      </svg>
    </button>
  );
}

export function FloatingPickerPortal({
  open,
  anchorRef,
  panelRef,
  onClose,
  children,
  panelClassName = '',
  bodyClassName = '',
  role,
  'aria-label': ariaLabel,
  widthMode,
}: FloatingPickerPortalProps) {
  const [mounted, setMounted] = useState(false);
  const pos = useComboboxFloatingDropdown({ open, panelRef: anchorRef, widthMode });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!mounted || !open || !pos) return null;

  return createPortal(
    <div
      ref={panelRef as RefObject<HTMLDivElement>}
      className={`picker-floating-panel${panelClassName ? ` ${panelClassName}` : ''}`}
      style={{
        top: pos.top,
        left: pos.left,
        width: pos.width,
        maxHeight: pos.maxHeight,
        transform: pos.flipUp ? 'translateY(-100%)' : undefined,
      }}
      role={role}
      aria-label={ariaLabel}
    >
      <div className={`picker-floating-panel-body${bodyClassName ? ` ${bodyClassName}` : ''}`}>
        <FloatingPickerClose onClose={onClose} />
        {children}
      </div>
    </div>,
    document.body
  );
}
