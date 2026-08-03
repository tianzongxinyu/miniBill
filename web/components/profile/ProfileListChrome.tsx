import type { ReactNode } from 'react';

export function ProfilePageHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <h1 className="text-lg font-medium text-ink shrink-0">{title}</h1>
      {description != null && (
        <p className="flex-1 min-w-0 text-xs text-muted truncate">{description}</p>
      )}
      {action != null && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function AdminListRow({
  left,
  center,
  right,
}: {
  left: ReactNode;
  center: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-sm">
      <div className="min-w-0 truncate text-left">{left}</div>
      <div className="shrink-0 text-center text-muted px-2">{center}</div>
      <div className="flex items-center justify-end gap-1">{right}</div>
    </div>
  );
}
