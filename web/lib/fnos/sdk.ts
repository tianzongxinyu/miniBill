import type TrimApp from '@trimjs/web-app';

type TrimAppCtor = typeof import('@trimjs/web-app').default;

let sdkPromise: Promise<TrimApp | null> | null = null;
let sdkInstance: TrimApp | null = null;

async function loadSdk(): Promise<TrimApp | null> {
  if (typeof window === 'undefined') return null;
  try {
    const mod = await import('@trimjs/web-app');
    const Ctor = (mod.default ?? mod) as TrimAppCtor;
    const sdk = new Ctor();
    await sdk.ready();
    sdkInstance = sdk;
    return sdk;
  } catch {
    sdkInstance = null;
    return null;
  }
}

/** Lazy-init TrimApp; returns null outside browser or when SDK fails. */
export function getFnosSdk(): Promise<TrimApp | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (sdkInstance) return Promise.resolve(sdkInstance);
  if (!sdkPromise) sdkPromise = loadSdk();
  return sdkPromise;
}

export function canUseFnosSdk(): boolean {
  return typeof window !== 'undefined';
}

export async function isFnosHost(): Promise<boolean> {
  const sdk = await getFnosSdk();
  if (!sdk) return false;
  return sdk.isWeb === true && sdk.isStandaloneWeb === false;
}

export async function isFnosStandaloneWeb(): Promise<boolean> {
  const sdk = await getFnosSdk();
  if (!sdk) return false;
  return sdk.isStandaloneWeb === true;
}

export async function withFnosSdk<T>(
  fn: (sdk: TrimApp) => Promise<T>
): Promise<T | null> {
  try {
    const sdk = await getFnosSdk();
    if (!sdk) return null;
    return await fn(sdk);
  } catch {
    return null;
  }
}
