'use client';

import { type ReactNode, type RefObject } from 'react';
import { FloatingPickerPortal } from '@/components/ui/FloatingPickerPortal';

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
  return (
    <FloatingPickerPortal
      open={open}
      anchorRef={panelRef}
      panelRef={dropdownRef}
      onClose={onClose}
      role="listbox"
      bodyClassName="combobox-candidates-floating-body"
    >
      {children}
    </FloatingPickerPortal>
  );
}
