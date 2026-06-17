import { apiList, type Contact, type Tag } from '@/lib/api';
import { LEDGER_META_CHANGED } from '@/lib/ledgerEvents';

let enabledTagsPromise: Promise<Tag[]> | null = null;
let contactsPromise: Promise<Contact[]> | null = null;

export function invalidateLedgerMetaCache() {
  enabledTagsPromise = null;
  contactsPromise = null;
}

if (typeof window !== 'undefined') {
  window.addEventListener(LEDGER_META_CHANGED, invalidateLedgerMetaCache);
}

export function fetchEnabledTagsCached(): Promise<Tag[]> {
  if (!enabledTagsPromise) {
    enabledTagsPromise = apiList<Tag>('/tags?enabled=1').catch((err) => {
      enabledTagsPromise = null;
      throw err;
    });
  }
  return enabledTagsPromise;
}

export function fetchContactsCached(): Promise<Contact[]> {
  if (!contactsPromise) {
    contactsPromise = apiList<Contact>('/contacts').catch((err) => {
      contactsPromise = null;
      throw err;
    });
  }
  return contactsPromise;
}
