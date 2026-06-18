'use client';

import { useCallback, useRef, useState } from 'react';
import { useClickOutside } from '@/lib/combobox-utils';
import { FloatingPickerPortal } from '@/components/ui/FloatingPickerPortal';

export type OptionPickerItem = { value: number; label: string };

type OptionPickerFieldProps = {
  value: number;
  onChange: (value: number) => void;
  items: readonly OptionPickerItem[];
  disabled?: boolean;
  ariaLabel: string;
  panelTitle: string;
  gridClassName?: string;
};

export function OptionPickerField({
  value,
  onChange,
  items,
  disabled,
  ariaLabel,
  panelTitle,
  gridClassName = 'time-unit-picker-grid',
}: OptionPickerFieldProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLButtonElement>(null);
  const floatingPanelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useClickOutside([rootRef, floatingPanelRef], close);

  const selected = items.find((item) => item.value === value);
  const display = selected?.label ?? String(value);

  const select = (next: number) => {
    if (disabled) return;
    onChange(next);
    close();
  };

  return (
    <div
      ref={rootRef}
      className={['time-unit-picker', disabled && 'time-unit-picker-disabled'].filter(Boolean).join(' ')}
    >
      <button
        ref={fieldRef}
        type="button"
        className={[
          'time-unit-picker-field',
          open && 'time-unit-picker-field-open',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={() => {
          if (disabled) return;
          setOpen((o) => !o);
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={ariaLabel}
        disabled={disabled}
      >
        <span className="time-unit-picker-field-value tabular-nums">{display}</span>
        <span
          className={`time-unit-picker-field-chevron${open ? ' time-unit-picker-field-chevron-open' : ''}`}
          aria-hidden
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>

      <FloatingPickerPortal
        open={open}
        anchorRef={fieldRef}
        panelRef={floatingPanelRef}
        onClose={close}
        role="dialog"
        aria-label={panelTitle}
        widthMode="content"
      >
        <div className="time-unit-picker-panel">
          <p className="time-unit-picker-panel-title">{panelTitle}</p>
          <div className={gridClassName}>
            {items.map((item) => {
              const isSelected = item.value === value;
              return (
                <button
                  key={item.value}
                  type="button"
                  className={[
                    'time-unit-picker-option',
                    isSelected && 'time-unit-picker-option-selected',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => select(item.value)}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </FloatingPickerPortal>
    </div>
  );
}
