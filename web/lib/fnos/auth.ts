import type { AppAuthResult } from '@trimjs/web-app';
import { getFnosSdk, isFnosStandaloneWeb, withFnosSdk } from '@/lib/fnos/sdk';

export const FNOS_AUTH_MESSAGE_TYPE = 'minibill:fnos-auth-result';
export const FNOS_AUTH_STATE_KEY = 'minibill-fnos-auth-state';

export function createAuthState(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function authCallbackPath(): string {
  const base = window.location.pathname.match(/^(\/app\/[^/]+\/)/)?.[1] ?? '/';
  return `${base}fnos-auth-callback/`.replace(/\/{2,}/g, '/');
}

/** Pick a shared folder (admin). Returns authorized paths or null if cancelled/failed. */
export async function pickSharedBackupFolder(): Promise<string[] | null> {
  const sdk = await getFnosSdk();
  if (!sdk) return null;

  if (await isFnosStandaloneWeb()) {
    const state = createAuthState();
    try {
      sessionStorage.setItem(FNOS_AUTH_STATE_KEY, state);
    } catch {
      /* ignore */
    }
    const resultPromise = waitForAuthMessage(state);
    await sdk.openAppAuth(
      'pickSharedFile',
      {
        appName: 'minibill',
        sidebarGroup: ['myFiles', 'otherShare', 'favorites'],
        redirectUri: authCallbackPath(),
        state,
      },
      { target: '_blank', features: 'width=750,height=630' }
    );
    return resultPromise;
  }

  const res = await sdk.pickSharedFile({
    title: '选择备份目录',
    okText: '确认授权',
    sidebarGroup: ['myFiles', 'otherShare', 'favorites'],
  });
  if (!res || res.code !== 0 || !res.data?.length) return null;
  return res.data;
}

function waitForAuthMessage(expectedState: string): Promise<string[] | null> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      window.removeEventListener('message', onMessage);
      resolve(null);
    }, 5 * 60 * 1000);

    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== FNOS_AUTH_MESSAGE_TYPE) return;
      window.clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      const result = event.data.result as AppAuthResult | undefined;
      let stored = '';
      try {
        stored = sessionStorage.getItem(FNOS_AUTH_STATE_KEY) || '';
        sessionStorage.removeItem(FNOS_AUTH_STATE_KEY);
      } catch {
        /* ignore */
      }
      if (!result || result.status !== 'success') {
        resolve(null);
        return;
      }
      if (result.state && (result.state !== expectedState || (stored && result.state !== stored))) {
        resolve(null);
        return;
      }
      resolve(result.path?.length ? result.path : null);
    }

    window.addEventListener('message', onMessage);
  });
}

export async function openFnosBackupFolder(path: string) {
  if (!path) return null;
  return withFnosSdk((sdk) => sdk.openFileManager(path));
}

export async function openFnosBackupFile(path: string) {
  if (!path) return null;
  return withFnosSdk((sdk) => sdk.openFile(path));
}
