'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { ContactChip } from '@/components/ui/ContactChip';
import { useFormatDate } from '@/hooks/useFormatDate';
import type { HomeRecentContact } from '@/lib/homeRecentContacts';
import { contactDetailHref } from '@/lib/url';

export function HomeRecentContacts({ contacts }: { contacts: HomeRecentContact[] }) {
  const { t } = useTranslation();
  const { formatISODate } = useFormatDate();

  if (contacts.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between gap-3 mb-2 px-0.5">
        <h2 className="text-xs font-medium text-muted uppercase tracking-wide">
          {t('home.recentContacts')}
        </h2>
        <Link href="/profile/contacts/" className="text-xs text-accent shrink-0">
          {t('home.recentAll')} ›
        </Link>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-0.5 px-0.5">
        {contacts.map((c) => (
          <Link
            key={c.id}
            href={contactDetailHref(c.id, '/')}
            className="shrink-0"
          >
            <ContactChip name={c.name} subtitle={formatISODate(c.lastDate)} />
          </Link>
        ))}
      </div>
    </section>
  );
}
