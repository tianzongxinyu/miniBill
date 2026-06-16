'use client';

import { createPortal } from 'react-dom';
import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import { useComboboxFloatingDropdown } from '@/hooks/useComboboxFloatingDropdown';

export function ComboboxFloatingClose({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      className="combobox-floating-close"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      aria-label="关闭"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
      </svg>
    </button>
  );
}

type ComboboxFloatingCandidatesProps = {
  open: boolean;
  panelRef: RefObject<HTMLElement | null>;
  dropdownRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  children: ReactNode;
};

export function ComboboxFloatingCandidates({
  open,
  panelRef,
  dropdownRef,
  onClose,
  children,
}: ComboboxFloatingCandidatesProps) {
  const [mounted, setMounted] = useState(false);
  const pos = useComboboxFloatingDropdown({ open, panelRef });

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !open || !pos) return null;

  return createPortal(
    <div
      ref={dropdownRef as React.RefObject<HTMLDivElement>}
      className="combobox-candidates-floating combobox-candidates-floating-fixed"
      style={{
        top: pos.top,
        left: pos.left,
        width: pos.width,
        maxHeight: pos.maxHeight,
        transform: pos.flipUp ? 'translateY(-100%)' : undefined,
      }}
      role="listbox"
    >
      <div className="combobox-candidates-floating-body">
        <ComboboxFloatingClose onClose={onClose} />
        {children}
      </div>
    </div>,
    document.body
  );
}
