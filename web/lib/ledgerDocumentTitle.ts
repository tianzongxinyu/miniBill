/** Active ledger owner username for document.title; null when no ledger (e.g. login). */
let sharedOwnerUsername: string | null = null;
let sharedIsOwn = false;

export function setSharedLedgerTitleOwner(username: string | null, isOwn = false) {
  sharedOwnerUsername = username && username.trim() ? username.trim() : null;
  sharedIsOwn = Boolean(sharedOwnerUsername && isOwn);
}

export function getSharedLedgerTitleOwner(): string | null {
  return sharedOwnerUsername;
}

export function getSharedLedgerTitleIsOwn(): boolean {
  return sharedIsOwn;
}

export type LedgerDocumentTitleOptions = {
  ownerUsername?: string | null;
  isOwn?: boolean;
};

/**
 * Own / no ledger → `appName`;
 * other ledger → `{appName}({ownerUsername})`.
 */
export function ledgerDocumentTitle(
  appName: string,
  options?: LedgerDocumentTitleOptions
): string {
  const ownerUsername =
    options?.ownerUsername === undefined ? sharedOwnerUsername : options.ownerUsername;
  const isOwn = options?.isOwn === undefined ? sharedIsOwn : options.isOwn;
  if (isOwn || !ownerUsername) return appName;
  return `${appName}(${ownerUsername})`;
}
