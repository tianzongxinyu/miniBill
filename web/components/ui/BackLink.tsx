import Link from 'next/link';

export function PageBackLink({ href }: { href: string }) {
  return (
    <Link href={href} className="page-back-link">
      返回
    </Link>
  );
}

export function PageFooterActions({ children }: { children: React.ReactNode }) {
  return <div className="page-footer-actions">{children}</div>;
}
