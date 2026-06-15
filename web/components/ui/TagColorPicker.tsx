'use client';

import { useEffect, useRef, useState } from 'react';
import { TagChip } from '@/components/ui/TagChip';
import { generateRandomTagBgOptions, isTagColorHex } from '@/lib/tagColors';

type TagColorPickerProps = {
  name: string;
  colorBg: string;
  onSave: (bg: string) => void | Promise<void>;
  onClose: () => void;
};

const OPTION_COUNT = 12;

export function TagColorPicker({ name, colorBg, onSave, onClose }: TagColorPickerProps) {
  const [bg, setBg] = useState(colorBg);
  const [options, setOptions] = useState(() => generateRandomTagBgOptions(OPTION_COUNT, colorBg));
  const [saving, setSaving] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [onClose]);

  const valid = isTagColorHex(bg);
  const changed = bg !== colorBg;

  const refreshOptions = () => {
    setOptions(generateRandomTagBgOptions(OPTION_COUNT, bg));
  };

  const save = async (nextBg: string) => {
    if (!isTagColorHex(nextBg)) return;
    setSaving(true);
    try {
      await onSave(nextBg);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      ref={panelRef}
      className="mt-2 p-3 rounded-2xl border border-line bg-surface shadow-panel space-y-3"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-muted shrink-0">选择背景色</span>
          <button
            type="button"
            className="btn-ghost text-xs px-2 py-0.5 text-accent shrink-0"
            disabled={saving}
            onClick={refreshOptions}
          >
            换一批
          </button>
        </div>
        <TagChip name={name} colorBg={valid ? bg : colorBg} active />
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
        {options.map((presetBg) => {
          const selected = bg.toLowerCase() === presetBg.toLowerCase();
          return (
            <button
              key={presetBg}
              type="button"
              disabled={saving}
              aria-label="应用候选背景色"
              className={`h-9 rounded-xl border-2 transition-transform hover:scale-105 disabled:opacity-50 ${
                selected ? 'border-white ring-2 ring-ink/30 scale-105' : 'border-transparent'
              }`}
              style={{ backgroundColor: presetBg }}
              onClick={() => {
                setBg(presetBg);
                void save(presetBg);
              }}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap items-end gap-3 pt-1 border-t border-line/60">
        <label className="text-xs text-muted space-y-1">
          自定义背景
          <input
            type="color"
            value={valid ? bg : '#3B6FA8'}
            disabled={saving}
            className="block h-9 w-14 cursor-pointer rounded-lg border border-line bg-transparent p-0.5"
            onChange={(e) => setBg(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="btn-primary text-xs px-3 py-2 ml-auto"
          disabled={saving || !valid || !changed}
          onClick={() => void save(bg)}
        >
          {saving ? '保存中…' : '应用'}
        </button>
      </div>
    </div>
  );
}
