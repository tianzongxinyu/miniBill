import Link from 'next/link';

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="btn-ghost inline-flex mb-5 px-0 text-sm">
      ← {children}
    </Link>
  );
}
