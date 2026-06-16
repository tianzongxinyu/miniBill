export type DownloadMethod = 'download' | 'share' | 'open';

function parseFilenameFromDisposition(disposition: string): string | null {
  const utf8 = disposition.match(/filename\*=UTF-8''([^;\n]+)/i);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1].trim());
    } catch {
      /* ignore */
    }
  }
  const plain = disposition.match(/filename="?([^";\n]+)"?/i);
  return plain?.[1]?.trim() ?? null;
}

function isMobileLike(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(pointer: coarse) and (max-width: 1024px)').matches;
}

async function tryWebShare(blob: Blob, filename: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || typeof File === 'undefined' || !navigator.share) {
    return false;
  }
  const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
  if (navigator.canShare && !navigator.canShare({ files: [file] })) {
    return false;
  }
  try {
    await navigator.share({ files: [file], title: filename });
    return true;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return true;
    }
    return false;
  }
}

function tryAnchorDownload(url: string, filename: string): boolean {
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  } catch {
    return false;
  }
}

/** Save a Blob on device. Mobile WebView / iOS often need Web Share or open-in-new-tab. */
export async function downloadBlob(blob: Blob, filename: string): Promise<DownloadMethod> {
  const mobile = isMobileLike();

  if (mobile && (await tryWebShare(blob, filename))) {
    return 'share';
  }

  const url = URL.createObjectURL(blob);
  try {
    if (tryAnchorDownload(url, filename)) {
      return 'download';
    }
    if (!mobile && (await tryWebShare(blob, filename))) {
      return 'share';
    }
    window.open(url, '_blank', 'noopener,noreferrer');
    return 'open';
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}

export function downloadSuccessMessage(method: DownloadMethod): string {
  switch (method) {
    case 'share':
      return '已通过系统分享面板导出，请选择「存储到文件」或发送到文件 App';
    case 'open':
      return '已在新标签页打开 CSV，请使用浏览器菜单保存或分享';
    default:
      return '导出已开始下载，请查看浏览器或系统下载目录';
  }
}

export function parseExportFilename(
  disposition: string | null,
  fallback: string
): string {
  if (!disposition) return fallback;
  return parseFilenameFromDisposition(disposition) ?? fallback;
}
