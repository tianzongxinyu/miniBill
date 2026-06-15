import { getTransactionsFooterText } from '@/hooks/useTransactionsMonthNav';

export function TransactionsFooter({
  loadingMore,
  prevMonthDialogOpen,
  monthFullyLoaded,
  atBottom,
  canPromptPrevMonth,
}: {
  loadingMore: boolean;
  prevMonthDialogOpen: boolean;
  monthFullyLoaded: boolean;
  atBottom: boolean;
  canPromptPrevMonth: boolean;
}) {
  const text = getTransactionsFooterText({
    loadingMore,
    prevMonthDialogOpen,
    monthFullyLoaded,
    atBottom,
    canPromptPrevMonth,
  });
  if (!text) return null;

  return (
    <div className="bill-list-footer">
      <span className="bill-list-footer-text">{text}</span>
    </div>
  );
}
