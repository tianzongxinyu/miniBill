/** 标签文字固定色 */
export const TAG_TEXT_COLOR = '#ffffff';

/** 联系人 chip：浅青底 + 主题色字（检索框等与标签 pill 并列） */
export const CONTACT_CHIP_BG = '#E8F4F1';
export const CONTACT_CHIP_FG = '#3E8E7E';

/** 与 internal/domain/tagcolor.go tagBgPalette 保持一致（新建标签随机池） */
export const TAG_BG_PRESETS: readonly string[] = [
  '#3B6FA8',
  '#7B4FA8',
  '#B45309',
  '#BE3A5A',
  '#5A7A3C',
  '#4F46B5',
  '#C2410C',
  '#0E7490',
  '#8B6914',
  '#4A6B6B',
  '#9D4078',
  '#9B4444',
  '#6B4FA0',
  '#2E7D32',
];

export function isTagColorHex(s: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(s);
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const light = l / 100;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = light - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** 生成若干深色背景候选（配白字），每次调用结果不同。 */
export function generateRandomTagBgOptions(count = 12, includeBg?: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const push = (hex: string) => {
    const key = hex.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(hex);
  };

  if (includeBg && isTagColorHex(includeBg)) {
    push(includeBg);
  }

  let attempts = 0;
  while (out.length < count && attempts < count * 20) {
    attempts += 1;
    const h = Math.random() * 360;
    const s = 42 + Math.random() * 38;
    const l = 30 + Math.random() * 22;
    push(hslToHex(h, s, l));
  }

  while (out.length < count) {
    push(TAG_BG_PRESETS[Math.floor(Math.random() * TAG_BG_PRESETS.length)]);
  }

  return out.slice(0, count);
}
