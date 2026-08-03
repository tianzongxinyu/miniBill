'use client';

import { api, apiList } from '@/lib/api/http';
import type { AdminUser, DirectoryUser, LedgerAccessItem, LedgerGrantItem } from '@/lib/api/types';

const STORAGE_KEY = 'minibill_ledger_owner_id';

export function getStoredLedgerOwnerId(): number | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function setStoredLedgerOwnerId(ownerId: number | null) {
  if (typeof window === 'undefined') return;
  if (ownerId == null) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, String(ownerId));
  }
  window.dispatchEvent(new CustomEvent('ledger:access-changed'));
}

export function fetchLedgers() {
  return apiList<LedgerAccessItem>('/ledgers');
}

export function fetchUserDirectory() {
  return apiList<DirectoryUser>('/users/directory');
}

export function fetchLedgerGrants() {
  return apiList<LedgerGrantItem>('/ledger/grants');
}

export function upsertLedgerGrant(granteeUserId: number, permission: 'read' | 'edit') {
  return api<{ ok: boolean }>('/ledger/grants', {
    method: 'PUT',
    body: JSON.stringify({ grantee_user_id: granteeUserId, permission }),
  });
}

export function deleteLedgerGrant(granteeUserId: number) {
  return api(`/ledger/grants/${granteeUserId}`, { method: 'DELETE' });
}

export function fetchAdminUsers() {
  return apiList<AdminUser>('/admin/users');
}

export function adminCreateUser(username: string, password: string) {
  return api<AdminUser>('/admin/users', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function adminUpdateUser(id: number, body: { is_admin?: boolean; disabled?: boolean }) {
  return api<AdminUser>(`/admin/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function adminResetPassword(id: number, password: string) {
  return api<{ ok: boolean }>(`/admin/users/${id}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export function adminDeleteUser(id: number) {
  return api(`/admin/users/${id}`, { method: 'DELETE' });
}
