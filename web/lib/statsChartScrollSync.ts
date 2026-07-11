export type ScrollAnchor = {
  centerIndex: number;
  atEnd: boolean;
};

export function maxScrollLeft(scrollWidth: number, clientWidth: number): number {
  return Math.max(0, scrollWidth - clientWidth);
}

export function isAtScrollEnd(
  scrollLeft: number,
  clientWidth: number,
  scrollWidth: number,
  threshold = 4
): boolean {
  if (scrollWidth <= clientWidth + 1) return true;
  return scrollLeft >= maxScrollLeft(scrollWidth, clientWidth) - threshold;
}

export function getVisibleCenterIndex(
  scrollLeft: number,
  clientWidth: number,
  pointWidth: number,
  itemCount: number
): number {
  if (itemCount <= 0 || pointWidth <= 0) return 0;
  const centerPx = scrollLeft + clientWidth / 2;
  const index = centerPx / pointWidth;
  return Math.max(0, Math.min(itemCount - 1, index));
}

export function scrollLeftForCenterIndex(
  centerIndex: number,
  clientWidth: number,
  pointWidth: number,
  scrollWidth: number
): number {
  const raw = centerIndex * pointWidth - clientWidth / 2;
  return Math.max(0, Math.min(maxScrollLeft(scrollWidth, clientWidth), raw));
}

export function computeFullscreenSlotWidth(
  clientWidth: number,
  defaultLimit: number,
  minWidth = 32,
  horizontalPadding = 32
): number {
  const inner = Math.max(0, clientWidth - horizontalPadding);
  if (defaultLimit <= 0) return minWidth;
  return Math.max(minWidth, inner / defaultLimit);
}

export function captureScrollAnchor(
  scrollLeft: number,
  clientWidth: number,
  pointWidth: number,
  itemCount: number,
  scrollWidth: number
): ScrollAnchor {
  return {
    atEnd: isAtScrollEnd(scrollLeft, clientWidth, scrollWidth),
    centerIndex: getVisibleCenterIndex(scrollLeft, clientWidth, pointWidth, itemCount),
  };
}

export function mapScrollFromAnchor(
  anchor: ScrollAnchor,
  toClientWidth: number,
  toPointWidth: number,
  itemCount: number,
  toScrollWidth: number
): number {
  if (itemCount <= 0) return 0;
  if (anchor.atEnd) {
    return maxScrollLeft(toScrollWidth, toClientWidth);
  }
  return scrollLeftForCenterIndex(
    anchor.centerIndex,
    toClientWidth,
    toPointWidth,
    toScrollWidth
  );
}
