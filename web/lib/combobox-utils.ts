import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

type RefTarget = RefObject<HTMLElement | null>;

export function useClickOutside(
  refs: RefTarget | RefTarget[],
  onClose: () => void
) {
  const refsRef = useRef(Array.isArray(refs) ? refs : [refs]);
  refsRef.current = Array.isArray(refs) ? refs : [refs];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const inside = refsRef.current.some((ref) => ref.current?.contains(e.target as Node));
      if (!inside) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);
}

export function useComboboxKeyboard(opts: {
  open: boolean;
  setOpen: (v: boolean) => void;
  optionCount: number;
  hasCreate: boolean;
  onSelect: (index: number) => void;
  onCreate: () => void;
  onRemoveLast?: () => void;
}) {
  const { open, setOpen, optionCount, hasCreate, onSelect, onCreate, onRemoveLast } = opts;
  const [highlight, setHighlight] = useState(0);
  const total = optionCount + (hasCreate ? 1 : 0);

  useEffect(() => {
    setHighlight(0);
  }, [optionCount, hasCreate]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!open) setOpen(true);
        else setHighlight((h) => (total === 0 ? 0 : (h + 1) % total));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (!open) setOpen(true);
        else setHighlight((h) => (total === 0 ? 0 : (h - 1 + total) % total));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (!open) {
          setOpen(true);
          return;
        }
        if (highlight < optionCount) onSelect(highlight);
        else if (hasCreate) onCreate();
        return;
      }
      if (e.key === 'Backspace' && onRemoveLast) {
        const target = e.target as HTMLInputElement;
        if (target.value === '') onRemoveLast();
      }
    },
    [open, setOpen, highlight, optionCount, hasCreate, onSelect, onCreate, onRemoveLast, total]
  );

  return { highlight, setHighlight, onKeyDown };
}
