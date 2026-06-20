#!/usr/bin/env node
/**
 * Remove namespace-level *Failed keys superseded by common.loadFailed / saveFailed / deleteFailed.
 */
import { FE_LOCALES_DIR, loadLocales, readJson, writeJson } from './lib.mjs';
import path from 'node:path';

const DEPRECATED_KEYS = [
  'home.loadFailed',
  'tags.loadFailed',
  'tags.deleteFailed',
  'contacts.loadFailed',
  'contacts.deleteFailed',
  'backup.loadFailed',
  'backup.saveFailed',
  'add.loadFailed',
  'add.saveFailed',
  'add.deleteFailed',
  'balance.loadFailed',
  'balance.saveFailed',
  'settings.saveFailed',
  'error.loadFailed',
];

function deleteDottedKey(obj, dottedKey) {
  const parts = dottedKey.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur == null || typeof cur !== 'object') return false;
    cur = cur[parts[i]];
  }
  if (cur == null || typeof cur !== 'object') return false;
  const leaf = parts[parts.length - 1];
  if (!(leaf in cur)) return false;
  delete cur[leaf];
  return true;
}

const locales = loadLocales();
let totalRemoved = 0;

for (const locale of locales) {
  const filePath = path.join(FE_LOCALES_DIR, `${locale}.json`);
  const data = readJson(filePath);
  let removed = 0;
  for (const key of DEPRECATED_KEYS) {
    if (deleteDottedKey(data, key)) removed++;
  }
  if (removed > 0) {
    writeJson(filePath, data);
    console.log(`${locale}: removed ${removed} deprecated key(s)`);
    totalRemoved += removed;
  }
}

console.log(`Done. Removed ${totalRemoved} key(s) across ${locales.length} locale(s).`);
