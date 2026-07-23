'use client';

import { useCallback, useRef, useState } from 'react';
import { useClickOutside } from '@/lib/combobox-utils';
import { FloatingPickerPortal } from '@/components/ui/FloatingPickerPortal';

export type SimpleSelectOption = {
  value: string;
  label: string;
};

type SimpleSelectProps = {
  value: string;
  options: readonly SimpleSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  /** Default uses `.field`; compact uses soft date-picker-like trigger. */
  size?: 'default' | 'compact';
};

export function SimpleSelect({
  value,
  options,
  onChange,
  disabled = false,
  ariaLabel,
  className,
  size = 'default',
}: SimpleSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useClickOutside([rootRef, panelRef], close);

  const selected = options.find((o) => o.value === value);
  const displayLabel = selected?.label ?? value;
  const isPlaceholder = value === '';
  const compact = size === 'compact';

  const select = (next: string) => {
    if (disabled) return;
    onChange(next);
    close();
  };

  return (
    <div
      ref={rootRef}
      className={['simple-select min-w-0', className].filter(Boolean).join(' ')}
    >
      <button
        ref={fieldRef}
        type="button"
        className={[
          compact
            ? 'csv-map-field'
            : 'field w-full text-left flex items-center justify-between gap-2',
          compact && open && 'csv-map-field-open',
          !compact && open && 'ring-2 ring-accent/25 border-accent/45',
        ]
          .filter(Boolean)
          .join(' ')}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
      >
        <span
          className={[
            'truncate',
            compact && isPlaceholder && 'csv-map-field-placeholder',
            compact && !isPlaceholder && 'font-medium text-ink',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {displayLabel || '—'}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`shrink-0 text-muted/70 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <FloatingPickerPortal
        open={open}
        anchorRef={fieldRef}
        panelRef={panelRef}
        onClose={close}
        role="listbox"
        aria-label={ariaLabel}
        panelClassName="simple-select-floating"
        bodyClassName="simple-select-panel-body"
      >
        <ul className="simple-select-list max-h-[min(40vh,240px)] overflow-y-auto -mx-1">
          {options.map((opt, i) => {
            const isSelected = opt.value === value;
            return (
              <li key={`${opt.value}-${i}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={[
                    'simple-select-option w-full text-left px-3 py-2 rounded-xl transition-colors',
                    compact ? 'text-[13px]' : 'text-sm',
                    isSelected
                      ? 'bg-accent-soft text-accent font-medium'
                      : 'text-ink hover:bg-accent-soft/40',
                  ].join(' ')}
                  onClick={() => select(opt.value)}
                >
                  {opt.label}
                </button>
              </li>
            );
          })}
        </ul>
      </FloatingPickerPortal>
    </div>
  );
}
