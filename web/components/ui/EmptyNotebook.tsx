export function EmptyNotebook({
  message,
  hint,
}: {
  message: string;
  hint?: string;
}) {
  return (
    <div className="notebook p-8 text-center text-sm text-muted space-y-3">
      <p>{message}</p>
      {hint && <p className="text-xs text-muted/80">{hint}</p>}
    </div>
  );
}
