'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import {
  fetchLedgers,
  getStoredLedgerOwnerId,
  setStoredLedgerOwnerId,
  type LedgerAccessItem,
  type LedgerPermission,
} from '@/lib/api';
import { setSharedLedgerTitleOwner } from '@/lib/ledgerDocumentTitle';
import { notifyLedgerChanged, notifyLedgerMetaChanged } from '@/lib/ledgerEvents';

type LedgerAccessCtx = {
  ready: boolean;
  ledgers: LedgerAccessItem[];
  active: LedgerAccessItem | null;
  ownerId: number | null;
  permission: LedgerPermission;
  isOwner: boolean;
  canWrite: boolean;
  switchLedger: (ownerId: number) => void;
  refreshLedgers: () => Promise<void>;
  resetToOwn: () => void;
};

const LedgerAccessContext = createContext<LedgerAccessCtx | null>(null);

function pickActive(ledgers: LedgerAccessItem[], preferredOwnerId: number | null, selfId: number): LedgerAccessItem {
  if (preferredOwnerId != null) {
    const found = ledgers.find((l) => l.owner_id === preferredOwnerId);
    if (found) return found;
  }
  return ledgers.find((l) => l.owner_id === selfId) ?? ledgers[0];
}

export function LedgerAccessProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [ready, setReady] = useState(false);
  const [ledgers, setLedgers] = useState<LedgerAccessItem[]>([]);
  const [ownerId, setOwnerId] = useState<number | null>(null);

  const refreshLedgers = useCallback(async () => {
    if (!user) {
      setLedgers([]);
      setOwnerId(null);
      setReady(true);
      return;
    }
    try {
      const list = await fetchLedgers();
      setLedgers(list);
      const preferred = getStoredLedgerOwnerId();
      const active = pickActive(list, preferred, user.id);
      if (active) {
        setOwnerId(active.owner_id);
        if (preferred !== active.owner_id) {
          setStoredLedgerOwnerId(active.owner_id === user.id ? null : active.owner_id);
        }
      } else {
        setOwnerId(user.id);
        setStoredLedgerOwnerId(null);
      }
    } catch {
      setLedgers([{ owner_id: user.id, username: user.username, permission: 'owner' }]);
      setOwnerId(user.id);
    } finally {
      setReady(true);
    }
  }, [user]);

  useEffect(() => {
    setReady(false);
    void refreshLedgers();
  }, [refreshLedgers]);

  useEffect(() => {
    const onAccess = () => {
      const stored = getStoredLedgerOwnerId();
      setOwnerId(stored ?? user?.id ?? null);
    };
    const onReset = () => {
      void refreshLedgers();
    };
    window.addEventListener('ledger:access-changed', onAccess);
    window.addEventListener('ledger:access-reset', onReset);
    return () => {
      window.removeEventListener('ledger:access-changed', onAccess);
      window.removeEventListener('ledger:access-reset', onReset);
    };
  }, [refreshLedgers, user?.id]);

  const active = useMemo(() => {
    if (!user || ledgers.length === 0) return null;
    return pickActive(ledgers, ownerId, user.id);
  }, [ledgers, ownerId, user]);

  useEffect(() => {
    if (!active) {
      setSharedLedgerTitleOwner(null);
    } else {
      setSharedLedgerTitleOwner(active.username, active.permission === 'owner');
    }
  }, [active]);

  const switchLedger = useCallback(
    (nextOwnerId: number) => {
      if (!user) return;
      setStoredLedgerOwnerId(nextOwnerId === user.id ? null : nextOwnerId);
      setOwnerId(nextOwnerId);
      notifyLedgerChanged({ kind: 'transaction' });
      notifyLedgerMetaChanged();
      void refreshLedgers();
    },
    [refreshLedgers, user]
  );

  const resetToOwn = useCallback(() => {
    if (!user) return;
    setStoredLedgerOwnerId(null);
    setOwnerId(user.id);
    notifyLedgerChanged({ kind: 'transaction' });
    notifyLedgerMetaChanged();
    void refreshLedgers();
  }, [refreshLedgers, user]);

  const permission: LedgerPermission = active?.permission ?? 'owner';
  const isOwner = permission === 'owner';
  const canWrite = permission === 'owner' || permission === 'edit';

  const value = useMemo(
    () => ({
      ready,
      ledgers,
      active,
      ownerId: active?.owner_id ?? ownerId,
      permission,
      isOwner,
      canWrite,
      switchLedger,
      refreshLedgers,
      resetToOwn,
    }),
    [ready, ledgers, active, ownerId, permission, isOwner, canWrite, switchLedger, refreshLedgers, resetToOwn]
  );

  return <LedgerAccessContext.Provider value={value}>{children}</LedgerAccessContext.Provider>;
}

export function useLedgerAccess() {
  const ctx = useContext(LedgerAccessContext);
  if (!ctx) throw new Error('useLedgerAccess outside provider');
  return ctx;
}
