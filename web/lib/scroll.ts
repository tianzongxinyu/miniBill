export function getScrollY() {
  const main = document.querySelector('main');
  return Math.max(
    window.scrollY,
    document.documentElement.scrollTop,
    document.body.scrollTop,
    main?.scrollTop ?? 0
  );
}

export function isNearPageBottom(threshold = 32) {
  const scrollY = getScrollY();
  const viewport = window.innerHeight;
  const scrollHeight = Math.max(
    document.documentElement.scrollHeight,
    document.body.scrollHeight
  );
  return scrollY + viewport >= scrollHeight - threshold;
}

export function scrollToTop(smooth = true) {
  const opts: ScrollToOptions = { top: 0, left: 0, behavior: smooth ? 'smooth' : 'auto' };
  window.scrollTo(opts);
  document.documentElement.scrollTo(opts);
  document.body.scrollTo(opts);
  document.querySelector('main')?.scrollTo(opts);
}
