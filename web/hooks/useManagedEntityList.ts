'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiList } from '@/lib/api';
import { formatApiError } from '@/lib/errors';

type ManagedEntity = { id: number; name: string };

type UseManagedEntityListOptions<T extends ManagedEntity> = {
  listPath: string;
  fetchUsed: () => Promise<T[]>;
  createItem: (name: string) => Promise<unknown>;
  deleteItem: (id: number) => Promise<unknown>;
  createErrorFallback: string;
};

export function useManagedEntityList<T extends ManagedEntity>({
  listPath,
  fetchUsed,
  createItem,
  deleteItem,
  createErrorFallback,
}: UseManagedEntityListOptions<T>) {
  const { t } = useTranslation();
  const [items, setItems] = useState<T[]>([]);
  const [usedIds, setUsedIds] = useState<Set<number>>(() => new Set());
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<T | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [list, used] = await Promise.all([apiList<T>(listPath), fetchUsed()]);
      setItems(list);
      setUsedIds(new Set(used.map((item) => item.id)));
    } catch (e) {
      setItems([]);
      setUsedIds(new Set());
      setError(formatApiError(e, t('common.loadFailed')));
    }
  }, [listPath, fetchUsed, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createItem(name);
      setName('');
      void load();
    } catch (err) {
      setError(formatApiError(err, createErrorFallback));
    }
  };

  const confirmRemove = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await deleteItem(deleteTarget.id);
      setDeleteTarget(null);
      void load();
    } catch (err) {
      setError(formatApiError(err, t('common.deleteFailed')));
    } finally {
      setDeleting(false);
    }
  };

  return {
    items,
    setItems,
    usedIds,
    name,
    setName,
    error,
    setError,
    deleteTarget,
    setDeleteTarget,
    deleting,
    load,
    create,
    confirmRemove,
  };
}
