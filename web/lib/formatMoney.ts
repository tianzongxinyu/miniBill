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
