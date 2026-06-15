'use client';

import { createPortal } from 'react-dom';
import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import { useComboboxFloatingDropdown } from '@/hooks/useComboboxFloatingDropdown';

type ComboboxFloatingCandidatesProps = {
  open: boolean;
  panelRef: RefObject<HTMLElement | null>;
  dropdownRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
};

export function ComboboxFloatingCandidates({
  open,
  panelRef,
  dropdownRef,
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
      {children}
    </div>,
    document.body
  );
}
