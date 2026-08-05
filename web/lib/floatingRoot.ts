/** Portal target for floating chrome (glass bars). Prefer main overlay over body. */
export const FLOATING_ROOT_ID = 'minibill-floating-root';

export function getFloatingRoot(): HTMLElement {
  if (typeof document === 'undefined') {
    throw new Error('getFloatingRoot requires document');
  }
  return document.getElementById(FLOATING_ROOT_ID) ?? document.body;
}
