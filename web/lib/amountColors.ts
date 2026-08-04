export type AmountColorScheme = 'red_up' | 'green_up';

export const DEFAULT_AMOUNT_COLOR_SCHEME: AmountColorScheme = 'red_up';

const INCOME_HEX_FALLBACK = '#2F9E8A';
const EXPENSE_HEX_FALLBACK = '#E05252';

function readCssColor(varName: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return value || fallback;
}

function incomeHex(): string {
  return readCssColor('--color-income', INCOME_HEX_FALLBACK);
}

function expenseHex(): string {
  return readCssColor('--color-expense', EXPENSE_HEX_FALLBACK);
}

function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** 统计图净收入折线/面积色（固定支出语义色） */
export function netIncomeChartStroke(): string {
  return expenseHex();
}
export function netIncomeChartFillTop(): string {
  return hexToRgba(expenseHex(), 0.38);
}
export function netIncomeChartFillBottom(): string {
  return hexToRgba(expenseHex(), 0.06);
}

/** 统计图余额折线/面积色（淡青，与收支线区分） */
const BALANCE_STROKE_FALLBACK = '#7EC8BC';

export function balanceChartStroke(): string {
  return readCssColor('--color-accent-muted', BALANCE_STROKE_FALLBACK);
}
export function balanceChartFillTop(): string {
  return hexToRgba(balanceChartStroke(), 0.42);
}
export function balanceChartFillBottom(): string {
  return hexToRgba(balanceChartStroke(), 0.06);
}

type Direction = 'up' | 'down';
type ClassPrefix = 'amount' | 'text';

function classForDirection(
  dir: Direction,
  scheme: AmountColorScheme,
  prefix: ClassPrefix
): string {
  const upSemantic = scheme === 'red_up' ? 'expense' : 'income';
  const downSemantic = scheme === 'red_up' ? 'income' : 'expense';
  const semantic = dir === 'up' ? upSemantic : downSemantic;
  return prefix === 'amount' ? `amount-${semantic}` : `text-${semantic}`;
}

export function amountClassForType(
  type: 'income' | 'expense',
  scheme: AmountColorScheme
): string {
  return classForDirection(type === 'income' ? 'up' : 'down', scheme, 'text');
}

export function textClassForType(
  type: 'income' | 'expense',
  scheme: AmountColorScheme
): string {
  return classForDirection(type === 'income' ? 'up' : 'down', scheme, 'text');
}

/** 收支筛选按钮激活态 ring/bg，与 textClassForType 语义一致 */
export function filterActiveClassesForType(
  type: 'income' | 'expense',
  scheme: AmountColorScheme
): string {
  const semantic = textClassForType(type, scheme).replace('text-', '');
  if (semantic === 'expense') return 'ring-expense/50 bg-expense/15';
  return 'ring-income/50 bg-income/15';
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace('#', '');
  const full =
    cleaned.length === 3
      ? cleaned
          .split('')
          .map((c) => c + c)
          .join('')
      : cleaned;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return { r: 0, g: 0, b: 0 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** 筛选按钮激活态样式，与 chartStrokeForType / Amount 文字色一致 */
export function filterActiveStyleForType(
  type: 'income' | 'expense',
  scheme: AmountColorScheme
): { backgroundColor: string; boxShadow: string } {
  const { r, g, b } = hexToRgb(chartStrokeForType(type, scheme));
  return {
    backgroundColor: `rgba(${r}, ${g}, ${b}, 0.22)`,
    boxShadow: `inset 0 0 0 1px rgba(${r}, ${g}, ${b}, 0.5)`,
  };
}

/** 筛选按钮未选中态样式，语义色更浅 */
export function filterInactiveStyleForType(
  type: 'income' | 'expense',
  scheme: AmountColorScheme
): { backgroundColor: string; boxShadow: string; ['--filter-btn-hover-bg']: string } {
  const { r, g, b } = hexToRgb(chartStrokeForType(type, scheme));
  return {
    backgroundColor: `rgba(${r}, ${g}, ${b}, 0.05)`,
    boxShadow: `inset 0 0 0 1px rgba(${r}, ${g}, ${b}, 0.28)`,
    '--filter-btn-hover-bg': `rgba(${r}, ${g}, ${b}, 0.09)`,
  };
}

export function amountClassForSign(cents: number, scheme: AmountColorScheme): string {
  return classForDirection(cents >= 0 ? 'up' : 'down', scheme, 'text');
}

export function textClassForSign(cents: number, scheme: AmountColorScheme): string {
  return classForDirection(cents >= 0 ? 'up' : 'down', scheme, 'text');
}

export function textOpacityClassForType(
  type: 'income' | 'expense',
  scheme: AmountColorScheme
): string {
  return `${textClassForType(type, scheme)}/70`;
}

export function chartStrokeForType(
  type: 'income' | 'expense',
  scheme: AmountColorScheme
): string {
  const dir: Direction = type === 'income' ? 'up' : 'down';
  if (scheme === 'red_up') {
    return dir === 'up' ? expenseHex() : incomeHex();
  }
  return dir === 'up' ? incomeHex() : expenseHex();
}
