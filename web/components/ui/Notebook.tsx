import Link from 'next/link';

export function Notebook({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`notebook ${className}`}>{children}</div>;
}

export function NotebookRow({
  children,
  href,
  onClick,
  className = '',
}: {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
}) {
  const cls = `notebook-row ${className}`;
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${cls} w-full text-left`}>
        {children}
      </button>
    );
  }
  return <div className={cls}>{children}</div>;
}
