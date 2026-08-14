'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { RequireAuth } from '@/components/RequireAuth';
import { useLedgerAccess } from '@/components/LedgerAccessProvider';
import { useSettings } from '@/components/SettingsProvider';
import { DayOfMonthPicker } from '@/components/recurring/DayOfMonthPicker';
import { RecurringSwitch } from '@/components/recurring/RecurringSwitch';
import { PageBackLink, PageFooterActions } from '@/components/ui/BackLink';
import { ContactCombobox } from '@/components/ui/ContactCombobox';
import { LoadingFallback } from '@/components/ui/LoadingFallback';
import { TagCombobox } from '@/components/ui/TagCombobox';
import { amountClassForType } from '@/lib/amountColors';
import {
  api,
  createRecurringRule,
  fetchTransactionFormMeta,
  updateRecurringRule,
  yuanToCents,
  type Contact,
  type RecurringRule,
  type Tag,
  type TransactionTagItem,
} from '@/lib/api';
import { formatApiError } from '@/lib/errors';

function RecurringEditContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useSearchParams();
  const { canWrite } = useLedgerAccess();
  const { scheme } = useSettings();
  const editId = params.get('id');
  const isEdit = Boolean(editId);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [note, setNote] = useState('');
  const [tags, setTags] = useState<Tag[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [selectedTagItems, setSelectedTagItems] = useState<TransactionTagItem[]>([]);
  const [contactId, setContactId] = useState<number | ''>('');
  const [enabled, setEnabled] = useState(true);

  const loadMeta = useCallback(async () => {
    const meta = await fetchTransactionFormMeta();
    setTags(meta.tags);
    setContacts(meta.contacts);
    return meta;
  }, []);

  useEffect(() => {
    if (!canWrite) {
      router.replace('/profile/recurring/');
    }
  }, [canWrite, router]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (!isEdit) {
          await loadMeta();
          return;
        }
        if (!editId) return;
        setLoading(true);
        const [rule, meta] = await Promise.all([
          api<RecurringRule>(`/recurring-rules/${editId}`),
          loadMeta(),
        ]);
        if (cancelled) return;
        setType(rule.type);
        setAmount((rule.amount / 100).toFixed(2));
        setDayOfMonth(rule.day_of_month);
        setNote(rule.note || '');
        setSelectedTags(rule.tag_ids ?? []);
        setSelectedTagItems(rule.tag_items ?? []);
        setContactId(rule.contact_id ?? '');
        setEnabled(rule.enabled);
        if (rule.contact_id && !meta.contacts.some((c) => c.id === rule.contact_id)) {
          setContacts([
            ...meta.contacts,
            {
              id: rule.contact_id,
              name: rule.contact_name || String(rule.contact_id),
              nickname: '',
              relation_group: '',
              note: '',
              phone: '',
              enabled: false,
            },
          ]);
        }
      } catch (e) {
        if (!cancelled) setError(formatApiError(e, t('common.loadFailed')));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editId, isEdit, loadMeta, t]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite || saving) return;
    setError('');
    const cents = yuanToCents(amount);
    if (cents <= 0) {
      setError(t('recurring.invalidAmount'));
      return;
    }
    if (dayOfMonth < 1 || dayOfMonth > 28) {
      setError(t('recurring.invalidDay'));
      return;
    }
    const body = {
      amount: cents,
      type,
      day_of_month: dayOfMonth,
      note: note.trim(),
      contact_id: contactId || null,
      tag_ids: selectedTags,
      enabled,
    };
    setSaving(true);
    try {
      if (isEdit && editId) {
        await updateRecurringRule(Number(editId), body);
      } else {
        await createRecurringRule(body);
      }
      router.push('/profile/recurring/');
    } catch (err) {
      setError(formatApiError(err, t('common.saveFailed')));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="add-form">
        <h1 className="form-page-title">
          {isEdit ? t('recurring.editTitle') : t('recurring.createTitle')}
        </h1>
        <p className="text-muted text-sm">{t('common.loading')}</p>
        <PageBackLink href="/profile/recurring/" />
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="add-form record-form recurring-edit-form">
      <h1 className="form-page-title">
        {isEdit ? t('recurring.editTitle') : t('recurring.createTitle')}
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
          <div className="form-label">{t('recurring.dayOfMonth')}</div>
          <DayOfMonthPicker value={dayOfMonth} onChange={setDayOfMonth} />
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
            placeholder={t('add.contact')}
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

        <div className="form-row form-row-start">
          <div className="form-label">{t('recurring.enabledShort')}</div>
          <div className="flex flex-col gap-1.5 py-1.5">
            <RecurringSwitch
              checked={enabled}
              onChange={setEnabled}
              label={t('recurring.enabledShort')}
            />
            <p className="text-xs text-muted leading-snug">{t('recurring.enabledHint')}</p>
          </div>
        </div>
      </div>

      <PageFooterActions>
        <button type="submit" className="form-submit" disabled={saving}>
          {saving ? t('common.processing') : t('common.save')}
        </button>
        <PageBackLink href="/profile/recurring/" />
      </PageFooterActions>
    </form>
  );
}

export default function RecurringEditPage() {
  return (
    <RequireAuth>
      <Suspense fallback={<LoadingFallback />}>
        <RecurringEditContent />
      </Suspense>
    </RequireAuth>
  );
}
