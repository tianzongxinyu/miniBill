'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RequireAuth } from '@/components/RequireAuth';
import { PageBackLink, PageFooterActions } from '@/components/ui/BackLink';
import { PageHeader } from '@/components/ui/PageHeader';
import { DatePickerField } from '@/components/ui/DatePickerField';
import { TagCombobox } from '@/components/ui/TagCombobox';
import { ContactCombobox } from '@/components/ui/ContactCombobox';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LoadingFallback } from '@/components/ui/LoadingFallback';
import { useSettings } from '@/components/SettingsProvider';
import { amountClassForType, textOpacityClassForType } from '@/lib/amountColors';
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

function AddContent() {
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
        setError(formatApiError(e, '加载失败'))
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
        setContacts(meta.contacts);
        setSelectedTags(txData.tag_ids ?? []);
        setSelectedTagItems(txData.tag_items ?? []);
        setContactId(txData.contact_id ?? '');
      })
      .catch((e) => setError(formatApiError(e, '加载失败')))
      .finally(() => setLoading(false));
  }, [editId, isEdit, loadMeta]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cents = yuanToCents(amount);
    if (cents <= 0) {
      setError('请输入有效金额');
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
      setError(formatApiError(err, '保存失败'));
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
      setError(formatApiError(err, '删除失败'));
    } finally {
      setDeleting(false);
    }
  };

  const backHref = returnTo;

  if (loading) {
    return (
      <div className="add-form">
        <p className="text-muted text-sm">加载中…</p>
        <PageBackLink href={backHref} />
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="add-form">
      <PageHeader title={isEdit ? '编辑流水' : '记一笔'} />

      {error && <p className="form-alert-error">{error}</p>}

      <div className="form-hero">
        <div className="form-hero-type">
          {(['expense', 'income'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={type === t ? 'btn-segment-active' : 'btn-segment'}
            >
              {t === 'expense' ? '支出' : '收入'}
            </button>
          ))}
        </div>
        <div className="form-hero-amount">
          <span className={`form-hero-currency ${textOpacityClassForType(type, scheme)}`}>¥</span>
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
          <div className="form-label">日期</div>
          <DatePickerField
            value={date}
            onChange={setDate}
            min={minDate || undefined}
            max={maxDate}
            required
          />
        </div>

        <div className="form-row">
          <div className="form-label">标签</div>
          <TagCombobox
            tags={tags}
            selectedIds={selectedTags}
            selectedItems={selectedTagItems}
            onChange={setSelectedTags}
            onTagsChange={setTags}
          />
        </div>

        <div className="form-row">
          <div className="form-label">联系人</div>
          <ContactCombobox
            contacts={contacts}
            value={contactId}
            onChange={setContactId}
            onContactsChange={setContacts}
          />
        </div>

        <div className="form-row form-row-start">
          <div className="form-label">备注</div>
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
            删除
          </button>

          <ConfirmDialog
            open={confirmOpen}
            title="确认删除"
            message="删除后无法恢复，确定要删除这笔流水吗？"
            confirmLabel="删除"
            confirming={deleting}
            onClose={() => setConfirmOpen(false)}
            onConfirm={confirmRemove}
          />
        </>
      )}

      <PageFooterActions>
        <button type="submit" className="form-submit">
          保存
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
