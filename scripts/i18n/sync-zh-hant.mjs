#!/usr/bin/env node
/**
 * Regenerate zh-Hant locale files from zh-Hans via OpenCC (simplified → traditional).
 *
 * Usage: node scripts/i18n/sync-zh-hant.mjs
 */
import path from 'node:path';
import { createRequire } from 'node:module';
import {
  BE_MESSAGES_DIR,
  FE_LOCALES_DIR,
  ROOT,
  readJson,
  writeJson,
} from './lib.mjs';

const require = createRequire(path.join(ROOT, 'web/package.json'));
const { Converter } = require('opencc-js');

const s2t = Converter({ from: 'cn', to: 'tw' });

function openccConvert(obj) {
  if (typeof obj === 'string') return s2t(obj);
  if (Array.isArray(obj)) return obj.map(openccConvert);
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = openccConvert(v);
    }
    return out;
  }
  return obj;
}

console.log('Syncing zh-Hant from zh-Hans (OpenCC)...');
const zhHansFe = readJson(path.join(FE_LOCALES_DIR, 'zh-Hans.json'));
const zhHansBe = readJson(path.join(BE_MESSAGES_DIR, 'zh-Hans.json'));
writeJson(path.join(FE_LOCALES_DIR, 'zh-Hant.json'), openccConvert(zhHansFe));
writeJson(path.join(BE_MESSAGES_DIR, 'zh-Hant.json'), openccConvert(zhHansBe));
console.log('Done.');
