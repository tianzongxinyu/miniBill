import { toIntlLocale } from '@/lib/i18n/intlLocale';

function numberFormatter(locale: string): Intl.NumberFormat {
  return new Intl.NumberFormat(toIntlLocale(locale), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatMoneyAmount(cents: number, locale: string, abs = false): string {
  const yuan = abs ? Math.abs(cents) / 100 : cents / 100;
  return numberFormatter(locale).format(yuan);
}

export function formatTypedMoney(
  cents: number,
  type: 'income' | 'expense',
  locale: string
): string {
  const sign = type === 'income' ? '+' : '-';
  return `${sign}${formatMoneyAmount(cents, locale, true)}`;
}

export function formatSignedMoney(cents: number, locale: string): string {
  const sign = cents >= 0 ? '+' : '-';
  return `${sign}${formatMoneyAmount(cents, locale, true)}`;
}

export function formatBalanceMoney(cents: number, locale: string): string {
  return `+${formatMoneyAmount(cents, locale, true)}`;
}

export function formatPlainMoney(cents: number, locale: string): string {
  return numberFormatter(locale).format(cents / 100);
}
