'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RequireAuth } from '@/components/RequireAuth';
import { useLedgerAccess } from '@/components/LedgerAccessProvider';
import { RecurringSwitch } from '@/components/recurring/RecurringSwitch';
import { Amount } from '@/components/ui/Amount';
import { PageBackLink } from '@/components/ui/BackLink';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyNotebook } from '@/components/ui/EmptyNotebook';
import { Notebook, NotebookRow } from '@/components/ui/Notebook';
import { TagChip } from '@/components/ui/TagChip';
import { TrashIcon } from '@/components/ui/TrashIcon';
import {
  deleteRecurringRule,
  fetchRecurringRules,
  updateRecurringRule,
  type RecurringRule,
} from '@/lib/api';
import { formatApiError } from '@/lib/errors';

function RecurringListContent() {
  const { t } = useTranslation();
  const { canWrite } = useLedgerAccess();
  const [items, setItems] = useState<RecurringRule[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<RecurringRule | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      setItems(await fetchRecurringRules());
    } catch (e) {
      setItems([]);
      setError(formatApiError(e, t('common.loadFailed')));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleEnabled = async (rule: RecurringRule) => {
    if (!canWrite) return;
    try {
      await updateRecurringRule(rule.id, {
        amount: rule.amount,
        type: rule.type,
        day_of_month: rule.day_of_month,
        note: rule.note,
        contact_id: rule.contact_id ?? null,
        tag_ids: rule.tag_ids ?? [],
        enabled: !rule.enabled,
      });
      await load();
    } catch (err) {
      setError(formatApiError(err, t('common.saveFailed')));
    }
  };

  const confirmRemove = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await deleteRecurringRule(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(formatApiError(err, t('common.deleteFailed')));
    } finally {
      setDeleting(false);
    }
  };

  const renderRow = (rule: RecurringRule) => {
    const day = t('recurring.dayOfMonthShort', { day: rule.day_of_month });
    const tagItems = rule.tag_items ?? [];
    const hasMeta = tagItems.length > 0 || Boolean(rule.contact_id && rule.contact_name);
    const emDash = t('common.emDash');
    const editHref = `/profile/recurring/edit/?id=${rule.id}`;
    const dim = rule.enabled ? '' : 'opacity-70';

    const meta = hasMeta ? (
      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
        {tagItems.map((tag) => (
          <TagChip
            key={tag.id ? tag.id : tag.name}
            name={tag.name}
            colorBg={tag.color_bg}
          />
        ))}
        {rule.contact_id && rule.contact_name ? (
          <span className="text-sm text-accent shrink-0">@{rule.contact_name}</span>
        ) : null}
      </div>
    ) : (
      <div className="text-sm text-ink truncate">{emDash}</div>
    );

    const Cell = ({
      children,
      className = '',
    }: {
      children: React.ReactNode;
      className?: string;
    }) =>
      canWrite ? (
        <Link href={editHref} className={`min-w-0 ${dim} ${className}`}>
          {children}
        </Link>
      ) : (
        <div className={`min-w-0 ${dim} ${className}`}>{children}</div>
      );

    return (
      <div
        className={`grid w-full gap-x-5 gap-y-1 items-center ${
          canWrite
            ? 'grid-cols-[minmax(0,1fr)_auto_auto]'
            : 'grid-cols-[minmax(0,1fr)_auto]'
        }`}
      >
        <Cell>
          <div className="text-xs text-muted tabular-nums leading-6">{day}</div>
        </Cell>
        <Cell className="text-right">
          <div className="leading-6">
            <Amount cents={rule.amount} type={rule.type} className="text-sm" />
          </div>
        </Cell>
        {canWrite && (
          <div className="flex justify-center">
            <RecurringSwitch
              checked={rule.enabled}
              onChange={() => void toggleEnabled(rule)}
              label={rule.enabled ? t('recurring.disable') : t('recurring.enable')}
            />
          </div>
        )}

        <Cell>{meta}</Cell>
        <Cell className="text-right">
          {rule.note ? (
            <div className="text-xs text-muted truncate leading-6">{rule.note}</div>
          ) : (
            <div className="leading-6" aria-hidden />
          )}
        </Cell>
        {canWrite && (
          <div className="flex justify-center">
            <button
              type="button"
              className="h-6 w-10 rounded-full inline-flex items-center justify-center bg-line text-muted hover:text-danger hover:bg-line/80"
              aria-label={t('common.delete')}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDeleteTarget(rule);
              }}
            >
              <TrashIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-1">
        <h1 className="form-page-title mb-0">{t('recurring.title')}</h1>
        {canWrite && (
          <Link href="/profile/recurring/edit/" className="btn-primary shrink-0 text-sm px-3 py-1.5">
            {t('recurring.create')}
          </Link>
        )}
      </div>
      <p className="text-muted text-xs mb-4">{t('recurring.descriptionShort')}</p>

      {error && <p className="form-alert-error mb-3">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted text-center py-8">{t('common.loading')}</p>
      ) : items.length === 0 ? (
        <div className="space-y-3">
          <EmptyNotebook message={t('recurring.empty')} />
          {canWrite && (
            <p className="text-center text-sm">
              <Link href="/profile/recurring/edit/" className="text-accent">
                {t('recurring.emptyHint')}
              </Link>
            </p>
          )}
        </div>
      ) : (
        <Notebook>
          {items.map((rule) => (
            <NotebookRow key={rule.id}>{renderRow(rule)}</NotebookRow>
          ))}
        </Notebook>
      )}

      <PageBackLink href="/profile/" floating />

      <ConfirmDialog
        open={deleteTarget != null}
        title={t('recurring.deleteTitle')}
        message={t('recurring.deleteConfirm')}
        confirmLabel={t('common.delete')}
        confirming={deleting}
        onConfirm={() => void confirmRemove()}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export default function RecurringPage() {
  return (
    <RequireAuth>
      <RecurringListContent />
    </RequireAuth>
  );
}
