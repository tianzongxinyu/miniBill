import { apiList, fetchUsedTransactionContacts, type Contact, type Tag } from '@/lib/api';

let enabledTagsPromise: Promise<Tag[]> | null = null;
let usedContactsPromise: Promise<Contact[]> | null = null;

export function fetchEnabledTagsCached(): Promise<Tag[]> {
  if (!enabledTagsPromise) {
    enabledTagsPromise = apiList<Tag>('/tags?enabled=1').catch((err) => {
      enabledTagsPromise = null;
      throw err;
    });
  }
  return enabledTagsPromise;
}

export function fetchUsedContactsCached(): Promise<Contact[]> {
  if (!usedContactsPromise) {
    usedContactsPromise = fetchUsedTransactionContacts().catch((err) => {
      usedContactsPromise = null;
      throw err;
    });
  }
  return usedContactsPromise;
}
