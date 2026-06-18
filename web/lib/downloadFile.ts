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

function tryAnchorDownload(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    tryAnchorDownload(url, filename);
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}

export function parseExportFilename(
  disposition: string | null,
  fallback: string
): string {
  if (!disposition) return fallback;
  return parseFilenameFromDisposition(disposition) ?? fallback;
}
