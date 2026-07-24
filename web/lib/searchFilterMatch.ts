import type { TagMatch } from './api/types';

/** 即时条件数：用于切换器可见性与是否回落「并」 */
export function matchToggleVisible(liveCount: number): boolean {
  return liveCount >= 2;
}

/** 条件不足 2 个时，将「或」回落为「并」 */
export function shouldResetTagMatch(liveCount: number): boolean {
  return liveCount < 2;
}

/** UI 展示：可见时保留用户选择，否则视为「并」 */
export function resolveUiTagMatch(liveCount: number, tagMatch: TagMatch): TagMatch {
  return matchToggleVisible(liveCount) ? tagMatch : 'all';
}

/** API：仅 settled 条件 ≥2 且用户选「或」时传 any */
export function resolveApiTagMatch(settledCount: number, tagMatch: TagMatch): TagMatch {
  return settledCount >= 2 && tagMatch === 'any' ? 'any' : 'all';
}
