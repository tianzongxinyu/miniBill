import type { Transaction } from '@/lib/api';

export type HomeRecentContact = {
  id: number;
  name: string;
  lastDate: string;
};

/** 按流水出现顺序（已按日期倒序）去重联系人。 */
export function uniqueRecentContacts(
  txs: Transaction[],
  limit = 6
): HomeRecentContact[] {
  const out: HomeRecentContact[] = [];
  const seen = new Set<number>();
  for (const tx of txs) {
    if (tx.contact_id == null || tx.contact_id <= 0 || !tx.contact_name) continue;
    if (seen.has(tx.contact_id)) continue;
    seen.add(tx.contact_id);
    out.push({
      id: tx.contact_id,
      name: tx.contact_name,
      lastDate: tx.transaction_date,
    });
    if (out.length >= limit) break;
  }
  return out;
}
