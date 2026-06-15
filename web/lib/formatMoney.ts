import { centsToYuan } from '@/lib/api';

export function formatTypedMoney(cents: number, type: 'income' | 'expense'): string {
  const sign = type === 'income' ? '+' : '-';
  return `${sign}¥${centsToYuan(cents)}`;
}

export function formatSignedMoney(cents: number): string {
  const sign = cents >= 0 ? '+' : '-';
  return `${sign}¥${centsToYuan(Math.abs(cents))}`;
}

export function formatBalanceMoney(cents: number): string {
  return `+¥${centsToYuan(cents)}`;
}

function formatCompactYuanAmount(absYuan: number): string {
  if (absYuan >= 10000) return `${(absYuan / 10000).toFixed(1)}万`;
  if (absYuan >= 1000) return `${(absYuan / 1000).toFixed(1)}k`;
  if (absYuan >= 100 || Number.isInteger(absYuan)) return absYuan.toFixed(0);
  return absYuan.toFixed(1);
}

/** Y 轴刻度：左轴带符号 */
export function formatAxisYuan(yuan: number): string {
  const abs = Math.abs(yuan);
  const amount = formatCompactYuanAmount(abs);
  if (yuan < 0) return `-¥${amount}`;
  if (yuan > 0) return `+¥${amount}`;
  return '¥0';
}

/** Y 轴刻度：右轴余额（无符号） */
export function formatAxisBalanceYuan(yuan: number): string {
  return `¥${formatCompactYuanAmount(Math.abs(yuan))}`;
}
