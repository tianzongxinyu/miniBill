export const YEARS_PER_PAGE = 12;

export function yearPageStart(y: number): number {
  return Math.floor((y - 1) / YEARS_PER_PAGE) * YEARS_PER_PAGE + 1;
}
