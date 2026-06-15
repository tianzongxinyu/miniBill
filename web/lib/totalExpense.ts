/** 总支出 = 记录支出 + 日常支出（daily 为 null 时仅记录部分） */
export function totalExpenseCents(
  recordedExpense: number,
  dailyExpense?: number | null
): number {
  if (dailyExpense == null) return recordedExpense;
  return recordedExpense + dailyExpense;
}
