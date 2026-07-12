export const CHART_MARGIN = { top: 8, right: 8, left: 16, bottom: 16 };
export const CHART_MARGIN_FULLSCREEN = { top: 8, right: 8, left: 16, bottom: 28 };
export const Y_AXIS_WIDTH = 8;
export const TOOLTIP_LINE_GAP = 14;
export const TOOLTIP_EDGE_PAD = 8;

export function computeTapInspectTooltipStyle(
  tooltipLeft: number,
  tooltipWidth: number,
  chartWidth: number
): { left: number; top: number; transform: string } {
  const gap = TOOLTIP_LINE_GAP;
  const fitsRight = tooltipLeft + gap + tooltipWidth <= chartWidth - TOOLTIP_EDGE_PAD;
  const fitsLeft = tooltipLeft - gap - tooltipWidth >= TOOLTIP_EDGE_PAD;

  if (fitsRight || !fitsLeft) {
    return { left: tooltipLeft + gap, top: 8, transform: 'none' };
  }
  return { left: tooltipLeft - gap, top: 8, transform: 'translateX(-100%)' };
}

export function categoryCenterX(
  index: number,
  chartWidth: number,
  dataLength: number,
  pointWidth: number,
  searchActive: boolean,
  tapToInspect: boolean
): number {
  const margin = tapToInspect ? CHART_MARGIN_FULLSCREEN : CHART_MARGIN;
  const yAxisRight = searchActive ? 0 : Y_AXIS_WIDTH;
  const innerW = chartWidth - margin.left - margin.right - Y_AXIS_WIDTH - yAxisRight;
  const halfPoint = pointWidth / 2;
  const plotStart = margin.left + Y_AXIS_WIDTH + halfPoint;
  if (dataLength <= 1) return plotStart;
  const step = (innerW - 2 * halfPoint) / (dataLength - 1);
  return plotStart + index * step;
}

export function pickIndexFromPlotFormula(
  localX: number,
  chartWidth: number,
  dataLength: number,
  pointWidth: number,
  searchActive: boolean
): number {
  const margin = CHART_MARGIN_FULLSCREEN;
  const yAxisRight = searchActive ? 0 : Y_AXIS_WIDTH;
  const innerW = chartWidth - margin.left - margin.right - Y_AXIS_WIDTH - yAxisRight;
  const halfPoint = pointWidth / 2;
  const plotStart = margin.left + Y_AXIS_WIDTH + halfPoint;

  if (dataLength <= 1) return 0;
  const step = (innerW - 2 * halfPoint) / (dataLength - 1);
  const idx = Math.round((localX - plotStart) / step);
  return Math.max(0, Math.min(dataLength - 1, idx));
}

export function localXFromSvgCtm(clientX: number, clientY: number, shellEl: HTMLElement): number | null {
  const svg = shellEl.querySelector('svg');
  if (!(svg instanceof SVGSVGElement)) return null;
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  return pt.matrixTransform(ctm.inverse()).x;
}

export function chartXToScreenY(chartX: number, shellEl: HTMLElement): number | null {
  const svg = shellEl.querySelector('svg');
  if (!(svg instanceof SVGSVGElement)) return null;
  const pt = svg.createSVGPoint();
  pt.x = chartX;
  pt.y = 0;
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  return pt.matrixTransform(ctm).y;
}

export function queryCategoryTickNodes(shellEl: HTMLElement): Element[] {
  const byAttr = shellEl.querySelectorAll('[data-category-name]');
  if (byAttr.length > 0) return Array.from(byAttr);

  return Array.from(
    shellEl.querySelectorAll('.recharts-xAxis .recharts-cartesian-axis-tick text, .recharts-xAxis text')
  );
}

export function readTickName(node: Element): string | null {
  const fromAttr = node.getAttribute('data-category-name');
  if (fromAttr) return fromAttr;
  const text = node.textContent?.trim();
  return text || null;
}

export function readTickSvgX(node: Element): number | null {
  const fromAttr = node.getAttribute('data-category-x') ?? node.getAttribute('x');
  if (fromAttr == null) return null;
  const tickX = Number(fromAttr);
  return Number.isFinite(tickX) ? tickX : null;
}

export type CategoryPick = {
  index: number;
  tooltipLeft: number;
};

type SlotPickAxis = 'x' | 'y';

export function pickNearestSlot(
  clientX: number,
  clientY: number,
  shellEl: HTMLElement,
  axis: SlotPickAxis,
  chartWidth: number,
  dataLength: number,
  pointWidth: number,
  searchActive: boolean
): number {
  const shellRect = shellEl.getBoundingClientRect();
  let bestIndex = 0;
  let bestDist = Infinity;

  for (let i = 0; i < dataLength; i++) {
    const slotX = categoryCenterX(i, chartWidth, dataLength, pointWidth, searchActive, true);
    let dist: number;
    if (axis === 'x') {
      dist = Math.abs(clientX - (shellRect.left + slotX));
    } else {
      const screenY = chartXToScreenY(slotX, shellEl);
      if (screenY == null) continue;
      dist = Math.abs(clientY - screenY);
    }
    if (dist < bestDist) {
      bestDist = dist;
      bestIndex = i;
    }
  }

  if (bestDist === Infinity && axis === 'y') {
    const localX = localXFromSvgCtm(clientX, clientY, shellEl);
    if (localX != null) {
      return pickIndexFromPlotFormula(localX, chartWidth, dataLength, pointWidth, searchActive);
    }
  }

  return bestIndex;
}

export function pickRotatedCategoryFromTicks(
  clientY: number,
  shellEl: HTMLElement,
  categoryNames: readonly string[]
): number | null {
  const ticks = queryCategoryTickNodes(shellEl);
  if (ticks.length === 0) return null;

  let bestName: string | null = null;
  let bestDist = Infinity;

  for (const node of ticks) {
    const name = readTickName(node);
    if (!name || categoryNames.indexOf(name) < 0) continue;
    const rect = node.getBoundingClientRect();
    const dist = Math.abs(clientY - (rect.top + rect.height / 2));
    if (dist < bestDist) {
      bestDist = dist;
      bestName = name;
    }
  }

  if (bestName == null) return null;
  const index = categoryNames.indexOf(bestName);
  return index >= 0 ? index : null;
}

export function tooltipAnchorX(
  index: number,
  shellEl: HTMLElement,
  categoryNames: readonly string[],
  chartWidth: number,
  dataLength: number,
  pointWidth: number,
  searchActive: boolean,
  isRotated: boolean
): number {
  const name = categoryNames[index];

  if (isRotated) {
    const tickNode = queryCategoryTickNodes(shellEl).find((node) => readTickName(node) === name);
    return (
      (tickNode ? readTickSvgX(tickNode) : null) ??
      categoryCenterX(index, chartWidth, dataLength, pointWidth, searchActive, true)
    );
  }

  const shellRect = shellEl.getBoundingClientRect();
  for (const node of queryCategoryTickNodes(shellEl)) {
    if (readTickName(node) !== name) continue;
    const rect = node.getBoundingClientRect();
    return rect.left + rect.width / 2 - shellRect.left;
  }

  return categoryCenterX(index, chartWidth, dataLength, pointWidth, searchActive, true);
}

export function pickCategoryAtPointer(
  clientX: number,
  clientY: number,
  shellEl: HTMLElement,
  chartWidth: number,
  categoryNames: readonly string[],
  pointWidth: number,
  searchActive: boolean,
  tapToInspect: boolean,
  isRotated: boolean
): CategoryPick | null {
  const dataLength = categoryNames.length;
  if (!tapToInspect || dataLength === 0) return null;

  const index = isRotated
    ? (pickRotatedCategoryFromTicks(clientY, shellEl, categoryNames) ??
      pickNearestSlot(
        clientX,
        clientY,
        shellEl,
        'y',
        chartWidth,
        dataLength,
        pointWidth,
        searchActive
      ))
    : pickNearestSlot(
        clientX,
        clientY,
        shellEl,
        'x',
        chartWidth,
        dataLength,
        pointWidth,
        searchActive
      );

  return {
    index,
    tooltipLeft: tooltipAnchorX(
      index,
      shellEl,
      categoryNames,
      chartWidth,
      dataLength,
      pointWidth,
      searchActive,
      isRotated
    ),
  };
}
