'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { locales, type TLocale } from '@/src/i18n';
import {
  getActiveLocale,
  getLocaleDisplayName,
  loadLocale,
  localeMatchesSearch,
  markLocaleExplicit,
  type Locale,
} from '@/lib/i18n/utils';
import { useClickOutside } from '@/lib/combobox-utils';
import { FloatingPickerPortal } from '@/components/ui/FloatingPickerPortal';

type LocaleSelectProps = {
  variant?: 'compact' | 'full';
  value?: Locale;
  onChange?: (locale: Locale) => void;
  /** When true, mark choice for sync to account settings after login/register. */
  markExplicitOnChange?: boolean;
  searchable?: boolean;
  disabled?: boolean;
};

export function LocaleSelect({
  variant = 'full',
  value,
  onChange,
  markExplicitOnChange = false,
  searchable = variant === 'full',
  disabled = false,
}: LocaleSelectProps) {
  const { t, i18n } = useTranslation();
  const uiLocale = i18n.language;
  const current = value ?? getActiveLocale();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  useClickOutside([rootRef, panelRef], close);

  const filteredLocales = useMemo(() => {
    if (!searchable || !query.trim()) return locales as readonly TLocale[];
    return (locales as readonly TLocale[]).filter((loc) => localeMatchesSearch(loc, query, uiLocale));
  }, [query, searchable, uiLocale]);

  const select = (locale: Locale) => {
    if (disabled) return;
    if (onChange) {
      onChange(locale);
    } else {
      if (markExplicitOnChange) markLocaleExplicit(locale);
      void loadLocale(locale);
    }
    close();
  };

  const displayLabel = getLocaleDisplayName(current);

  if (variant === 'compact') {
    return (
      <div className="locale-select-compact">
        <label className="text-xs text-muted" htmlFor="locale-select-compact">
          {t('settings.language')}
        </label>
        <select
          id="locale-select-compact"
          className="field text-sm mt-1"
          value={current}
          disabled={disabled}
          onChange={(e) => select(e.target.value as Locale)}
        >
          {(locales as readonly TLocale[]).map((loc) => (
            <option key={loc} value={loc}>
              {getLocaleDisplayName(loc)}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="locale-select-full min-w-0">
      <button
        ref={fieldRef}
        type="button"
        className={['field w-full text-left flex items-center justify-between gap-2', open && 'ring-1 ring-accent/30']
          .filter(Boolean)
          .join(' ')}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="truncate">{displayLabel}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-muted" aria-hidden>
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <FloatingPickerPortal
        open={open}
        anchorRef={fieldRef}
        panelRef={panelRef}
        onClose={close}
        role="listbox"
        bodyClassName="locale-select-panel-body"
      >
        {searchable && (
          <input
            type="search"
            className="field w-full mb-2"
            placeholder={t('settings.languageSearch')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
        )}
        <ul className="locale-select-list max-h-[min(50vh,280px)] overflow-y-auto">
          {filteredLocales.map((loc) => (
            <li key={loc}>
              <button
                type="button"
                role="option"
                aria-selected={loc === current}
                className={[
                  'locale-select-option w-full text-left px-3 py-2 text-sm transition-colors',
                  loc === current ? 'bg-accent-soft text-accent font-medium' : 'text-ink hover:bg-accent-soft/40',
                ].join(' ')}
                onClick={() => select(loc)}
              >
                {getLocaleDisplayName(loc)}
              </button>
            </li>
          ))}
        </ul>
      </FloatingPickerPortal>
    </div>
  );
}

