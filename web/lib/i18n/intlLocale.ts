/** Map app locale codes to BCP 47 tags for Intl APIs. */
const INTL_LOCALE_MAP: Record<string, string> = {
  'zh-Hans': 'zh-CN',
  'zh-Hant': 'zh-TW',
};

export function toIntlLocale(locale: string): string {
  return INTL_LOCALE_MAP[locale] ?? locale;
}
