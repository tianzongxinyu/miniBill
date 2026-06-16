'use client';

import { useCallback, useLayoutEffect, useState, type RefObject } from 'react';

export type ComboboxDropdownPos = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  flipUp: boolean;
};

type Options = {
  open: boolean;
  panelRef: RefObject<HTMLElement | null>;
  bottomSelectors?: string[];
};

const GLOBAL_BOTTOM_SELECTORS = ['.mobile-tab-nav'];

function collectBottomLimit(panelRect: DOMRect, selectors: string[], root?: ParentNode | null) {
  let bottomLimit = window.innerHeight - 16;
  for (const sel of selectors) {
    const nodes = root
      ? Array.from(root.querySelectorAll<HTMLElement>(sel))
      : Array.from(document.querySelectorAll<HTMLElement>(sel));
    for (const el of nodes) {
      const rect = el.getBoundingClientRect();
      if (rect.height <= 0 || rect.top <= panelRect.top) continue;
      bottomLimit = Math.min(bottomLimit, rect.top - 8);
    }
  }
  return bottomLimit;
}

export function useComboboxFloatingDropdown({
  open,
  panelRef,
  bottomSelectors = GLOBAL_BOTTOM_SELECTORS,
}: Options) {
  const [pos, setPos] = useState<ComboboxDropdownPos | null>(null);

  const update = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const panelRect = panel.getBoundingClientRect();
    const page = panel.closest('.max-w-3xl');
    const pageRect = page?.getBoundingClientRect();
    const pagePadX = window.matchMedia('(min-width: 1024px)').matches ? 32 : 16;
    const addForm = panel.closest('.add-form');

    let bottomLimit = collectBottomLimit(panelRect, bottomSelectors, null);
    if (addForm) {
      bottomLimit = Math.min(
        bottomLimit,
        collectBottomLimit(panelRect, ['.form-submit-wrap', '.btn-danger-block'], addForm)
      );
    }

    const gap = 8;
    const preferMax = window.innerHeight * 0.65;
    const spaceBelow = bottomLimit - (panelRect.bottom + gap);
    const spaceAbove = panelRect.top - gap - 16;

    let flipUp = false;
    let top = panelRect.bottom + gap;
    let maxHeight = Math.max(120, Math.min(spaceBelow, preferMax));

    if (maxHeight < 160 && spaceAbove > spaceBelow) {
      flipUp = true;
      top = panelRect.top - gap;
      maxHeight = Math.max(120, Math.min(spaceAbove, preferMax));
    }

    const layout = {
      top,
      maxHeight,
      flipUp,
      left: pageRect ? pageRect.left + pagePadX : pagePadX,
      width: pageRect ? pageRect.width - pagePadX * 2 : window.innerWidth - pagePadX * 2,
    };
    setPos(layout);
  }, [panelRef, bottomSelectors]);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, update]);

  return pos;
}
