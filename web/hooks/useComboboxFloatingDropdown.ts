'use client';

import { useCallback, useLayoutEffect, useState, type RefObject } from 'react';

export type ComboboxDropdownPos = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  flipUp: boolean;
};

type WidthMode = 'content' | 'page';

type Options = {
  open: boolean;
  panelRef: RefObject<HTMLElement | null>;
  bottomSelectors?: string[];
  /** 为 true 时把 add-form 内保存按钮当作底部遮挡 */
  clipToAddForm?: boolean;
  /** content=页面内容区（外层宽度减 padding，候选框默认）；page=整页容器（日期/月份选择器） */
  widthMode?: WidthMode;
};

const GLOBAL_BOTTOM_SELECTORS = ['.mobile-tab-nav'];

function pageBounds(pageContainer: Element, mode: WidthMode): { left: number; width: number } {
  const rect = pageContainer.getBoundingClientRect();
  if (mode === 'page') {
    return { left: rect.left, width: rect.width };
  }
  const style = window.getComputedStyle(pageContainer);
  const padL = parseFloat(style.paddingLeft) || 0;
  const padR = parseFloat(style.paddingRight) || 0;
  return {
    left: rect.left + padL,
    width: Math.max(0, rect.width - padL - padR),
  };
}

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
  clipToAddForm = false,
  widthMode = 'content',
}: Options) {
  const [pos, setPos] = useState<ComboboxDropdownPos | null>(null);

  const update = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const panelRect = panel.getBoundingClientRect();

    let bottomLimit = collectBottomLimit(panelRect, bottomSelectors, null);
    if (clipToAddForm) {
      const addForm = panel.closest('.add-form');
      if (addForm) {
        bottomLimit = Math.min(
          bottomLimit,
          collectBottomLimit(panelRect, ['.page-footer-actions', '.btn-danger-block'], addForm)
        );
      }
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

    const pageContainer = panel.closest('.max-w-3xl');
    let left: number;
    let width: number;
    if (pageContainer) {
      ({ left, width } = pageBounds(pageContainer, widthMode));
    } else {
      const margin = 16;
      left = margin;
      width = window.innerWidth - margin * 2;
    }

    const margin = 8;
    if (left < margin) {
      width -= margin - left;
      left = margin;
    }
    const maxRight = window.innerWidth - margin;
    if (left + width > maxRight) {
      width = Math.max(0, maxRight - left);
    }

    setPos({
      top,
      maxHeight,
      flipUp,
      left,
      width,
    });
  }, [panelRef, bottomSelectors, clipToAddForm, widthMode]);

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

export { useComboboxFloatingDropdown as useFloatingPickerPos };
