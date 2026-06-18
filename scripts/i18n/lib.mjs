import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '../..');

export const LOCALES_PATH = path.join(__dirname, 'locales.json');
export const FE_LOCALES_DIR = path.join(ROOT, 'web/src/locales');
export const BE_MESSAGES_DIR = path.join(ROOT, 'internal/i18n/messages');

export function loadLocales() {
  return JSON.parse(fs.readFileSync(LOCALES_PATH, 'utf8'));
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

/** Flatten nested object to dot-path keys. */
export function flatten(obj, prefix = '') {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(out, flatten(value, full));
    } else {
      out[full] = String(value);
    }
  }
  return out;
}

const PLACEHOLDER_RE = /\{\{(\w+)\}\}/g;

export function extractPlaceholders(text) {
  const set = new Set();
  for (const m of text.matchAll(PLACEHOLDER_RE)) {
    set.add(m[1]);
  }
  return [...set].sort();
}
