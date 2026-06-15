/** 流水扎差 = 总收入 - 总支出 */
export function netIncomeCents(totalIncome: number, totalExpense: number): number {
  return totalIncome - totalExpense;
}

/** 优先用 API 净收入（含余额登记时 = 月末 - 月初），否则回退流水扎差 */
export function resolveNetIncomeCents(item: {
  net_income?: number | null;
  total_income: number;
  total_expense: number;
}): number {
  if (item.net_income != null) return item.net_income;
  return netIncomeCents(item.total_income, item.total_expense);
}
