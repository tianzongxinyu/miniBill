'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { RequireAuth } from '@/components/RequireAuth';
import { PageBackLink, PageFooterActions } from '@/components/ui/BackLink';
import { DatePickerField } from '@/components/ui/DatePickerField';
import { TagCombobox } from '@/components/ui/TagCombobox';
import { ContactCombobox } from '@/components/ui/ContactCombobox';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LoadingFallback } from '@/components/ui/LoadingFallback';
import { useSettings } from '@/components/SettingsProvider';
import { amountClassForType } from '@/lib/amountColors';
import {
  Contact,
  deleteTransaction,
  fetchTransaction,
  fetchTransactionFormMeta,
  saveTransaction,
  Tag,
  Transaction,
  TransactionTagItem,
  yuanToCents,
} from '@/lib/api';
import { formatApiError } from '@/lib/errors';
import { notifyTransactionDates } from '@/lib/ledgerEvents';
import { parseDateParam, safeReturnTo } from '@/lib/url';

function mergeTagsForEdit(allTags: Tag[], tx: Transaction): Tag[] {
  const byId = new Map(allTags.map((t) => [t.id, t]));
  for (const item of tx.tag_items ?? []) {
    if (!byId.has(item.id)) {
      byId.set(item.id, {
        id: item.id,
        name: item.name,
        color_bg: item.color_bg,
        color_fg: item.color_fg,
        is_system: false,
        enabled: true,
        selectable: true,
      });
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
}

function mergeContactsForEdit(allContacts: Contact[], tx: Transaction): Contact[] {
  if (!tx.contact_id) return allContacts;
  if (allContacts.some((c) => c.id === tx.contact_id)) return allContacts;
  return [
    ...allContacts,
    {
      id: tx.contact_id,
      name: tx.contact_name || String(tx.contact_id),
      nickname: '',
      relation_group: '',
      note: '',
      phone: '',
      enabled: false,
    },
  ];
}

function AddContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useSearchParams();
  const { scheme } = useSettings();
  const editId = params.get('id');
  const isEdit = Boolean(editId);
  const returnTo = safeReturnTo(params.get('returnTo'), isEdit ? '/transactions/' : '/');
  const dateParam = params.get('date');

  const [loading, setLoading] = useState(isEdit);
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [originalDate, setOriginalDate] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [tags, setTags] = useState<Tag[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [selectedTagItems, setSelectedTagItems] = useState<TransactionTagItem[]>([]);
  const [contactId, setContactId] = useState<number | ''>('');
  const [minDate, setMinDate] = useState('');
  const [maxDate, setMaxDate] = useState('');
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadMeta = useCallback(async () => {
    const meta = await fetchTransactionFormMeta();
    setMinDate(meta.editableRange.min_date);
    setMaxDate(meta.editableRange.max_date);
    if (!isEdit) {
      setTags(meta.tags);
      setContacts(meta.contacts);
      const parsed = parseDateParam(dateParam);
      const { min_date, max_date } = meta.editableRange;
      const initialDate =
        parsed && parsed >= min_date && parsed <= max_date ? parsed : max_date;
      setDate(initialDate);
    }
    return meta;
  }, [isEdit, dateParam]);

  useEffect(() => {
    if (!isEdit) {
      loadMeta().catch((e) =>
        setError(formatApiError(e, t('common.loadFailed')))
      );
      return;
    }
    if (!editId) return;
    setLoading(true);
    Promise.all([fetchTransaction(editId), loadMeta()])
      .then(([txData, meta]) => {
        setType(txData.type);
        setAmount((txData.amount / 100).toFixed(2));
        setDate(txData.transaction_date);
        setOriginalDate(txData.transaction_date);
        setNote(txData.note);
        setTags(mergeTagsForEdit(meta.tags, txData));
        setContacts(mergeContactsForEdit(meta.contacts, txData));
        setSelectedTags(txData.tag_ids ?? []);
        setSelectedTagItems(txData.tag_items ?? []);
        setContactId(txData.contact_id ?? '');
      })
      .catch((e) => setError(formatApiError(e, t('common.loadFailed'))))
      .finally(() => setLoading(false));
  }, [editId, isEdit, loadMeta]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cents = yuanToCents(amount);
    if (cents <= 0) {
      setError(t('add.invalidAmount'));
      return;
    }
    const body = {
      amount: cents,
      type,
      transaction_date: date,
      note,
      contact_id: contactId || null,
      tag_ids: selectedTags,
    };
    try {
      await saveTransaction(body, isEdit ? editId : null);
      notifyTransactionDates(date, originalDate);
      router.push(returnTo);
    } catch (err) {
      setError(formatApiError(err, t('common.saveFailed')));
    }
  };

  const confirmRemove = async () => {
    if (!editId || deleting) return;
    setDeleting(true);
    try {
      await deleteTransaction(editId);
      notifyTransactionDates(date, originalDate);
      router.push(returnTo);
    } catch (err) {
      setConfirmOpen(false);
      setError(formatApiError(err, t('common.deleteFailed')));
    } finally {
      setDeleting(false);
    }
  };

  const backHref = returnTo;

  if (loading) {
    return (
      <div className="add-form">
        <h1 className="form-page-title">
          {isEdit ? t('add.editTitle') : t('add.createTitle')}
        </h1>
        <p className="text-muted text-sm">{t('common.loading')}</p>
        <PageBackLink href={backHref} />
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="add-form record-form">
      <h1 className="form-page-title">
        {isEdit ? t('add.editTitle') : t('add.createTitle')}
      </h1>

      {error && <p className="form-alert-error">{error}</p>}

      <div className="form-hero">
        <div className="form-hero-type">
          {(['expense', 'income'] as const).map((flowType) => (
            <button
              key={flowType}
              type="button"
              onClick={() => setType(flowType)}
              className={type === flowType ? 'btn-segment-active' : 'btn-segment'}
            >
              {flowType === 'expense' ? t('add.expense') : t('add.income')}
            </button>
          ))}
        </div>
        <div className="form-hero-amount">
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            className={`form-amount-input ${amountClassForType(type, scheme)}`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="form-details form-section-delay-1">
        <div className="form-row">
          <div className="form-label">{t('add.date')}</div>
          <DatePickerField
            value={date}
            onChange={setDate}
            min={minDate || undefined}
            max={maxDate}
            required
          />
        </div>

        <div className="form-row">
          <div className="form-label">{t('add.tags')}</div>
          <TagCombobox
            tags={tags}
            selectedIds={selectedTags}
            selectedItems={selectedTagItems}
            onChange={setSelectedTags}
            onTagsChange={setTags}
          />
        </div>

        <div className="form-row">
          <div className="form-label">{t('add.contact')}</div>
          <ContactCombobox
            contacts={contacts}
            value={contactId}
            onChange={setContactId}
            onContactsChange={setContacts}
          />
        </div>

        <div className="form-row form-row-start">
          <div className="form-label">{t('add.note')}</div>
          <textarea
            className="form-note-field"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>

      {isEdit && (
        <>
          <button type="button" onClick={() => setConfirmOpen(true)} className="btn-danger-block mt-3">
            {t('add.delete')}
          </button>

          <ConfirmDialog
            open={confirmOpen}
            title={t('add.confirmDeleteTitle')}
            message={t('add.confirmDeleteMessage')}
            confirmLabel={t('common.delete')}
            confirming={deleting}
            onClose={() => setConfirmOpen(false)}
            onConfirm={confirmRemove}
          />
        </>
      )}

      <PageFooterActions>
        <button type="submit" className="form-submit">
          {t('common.save')}
        </button>
        <PageBackLink href={backHref} />
      </PageFooterActions>
    </form>
  );
}

function AddPageInner() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AddContent />
    </Suspense>
  );
}

export default function AddPage() {
  return (
    <RequireAuth>
      <AddPageInner />
    </RequireAuth>
  );
}
