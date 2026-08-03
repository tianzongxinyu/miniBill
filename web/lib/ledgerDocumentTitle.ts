/** Active ledger owner username for document.title; null when no ledger (e.g. login). */
let sharedOwnerUsername: string | null = null;

export function setSharedLedgerTitleOwner(username: string | null) {
  sharedOwnerUsername = username && username.trim() ? username.trim() : null;
}

export function getSharedLedgerTitleOwner(): string | null {
  return sharedOwnerUsername;
}

/** With ledger → `{username}-{appName}`; otherwise `appName`. */
export function ledgerDocumentTitle(appName: string, ownerUsername?: string | null): string {
  const name = ownerUsername === undefined ? sharedOwnerUsername : ownerUsername;
  if (name) return `${name}-${appName}`;
  return appName;
}
