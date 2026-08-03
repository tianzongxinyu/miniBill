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
  /** Translated "我的账本" / "My ledger". */
  ownLabel?: string;
  /** Translated "{{name}}的账本" / "{{name}}'s ledger". */
  otherLabel?: string;
};

/**
 * With ledger → `{appName}（{ownLabel|otherLabel}）`;
 * otherwise `appName`.
 * Pass pre-translated labels from i18n.
 */
export function ledgerDocumentTitle(
  appName: string,
  options?: LedgerDocumentTitleOptions
): string {
  const ownerUsername =
    options?.ownerUsername === undefined ? sharedOwnerUsername : options.ownerUsername;
  const isOwn = options?.isOwn === undefined ? sharedIsOwn : options.isOwn;
  if (!ownerUsername && !isOwn) return appName;
  const inner = isOwn
    ? options?.ownLabel ?? ownerUsername
    : options?.otherLabel ?? ownerUsername;
  if (!inner) return appName;
  return `${appName}（${inner}）`;
}
