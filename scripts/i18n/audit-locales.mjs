#!/usr/bin/env node
/**
 * Production i18n audit: untranslated strings, FE/BE parity, empty values, leaked tokens.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BE_MESSAGES_DIR,
  FE_LOCALES_DIR,
  flatten,
  loadLocales,
  readJson,
} from './lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const allowlist = readJson(path.join(__dirname, 'allowlist.json'));
const parity = readJson(path.join(__dirname, 'parity.json'));

function isAllowlisted(key, value, enValue) {
  if (allowlist.keys[key]) return true;
  if (allowlist.exactValues.includes(value)) return true;
  for (const pattern of allowlist.valuePatterns) {
    if (new RegExp(pattern).test(value)) return true;
  }
  // Same as en only when en itself is a protected technical string
  if (value === enValue && allowlist.exactValues.includes(enValue)) return true;
  return false;
}

function auditIdenticalToEn(locales, enFeFlat, enBe) {
  let ok = true;
  for (const locale of locales) {
    if (locale === 'en') continue;
    const fe = flatten(readJson(path.join(FE_LOCALES_DIR, `${locale}.json`)));
    const be = readJson(path.join(BE_MESSAGES_DIR, `${locale}.json`));

    for (const [key, enVal] of Object.entries(enFeFlat)) {
      const val = fe[key];
      if (val === enVal && !isAllowlisted(key, val, enVal)) {
        console.error(`[audit] ${locale} frontend.${key}: identical to en (${JSON.stringify(enVal)})`);
        ok = false;
      }
    }
    for (const [key, enVal] of Object.entries(enBe)) {
      const val = be[key];
      if (val === enVal && !isAllowlisted(key, val, enVal)) {
        console.error(`[audit] ${locale} backend.${key}: identical to en (${JSON.stringify(enVal)})`);
        ok = false;
      }
    }
  }
  return ok;
}

function auditParity(locales) {
  let ok = true;
  for (const locale of locales) {
    const fe = flatten(readJson(path.join(FE_LOCALES_DIR, `${locale}.json`)));
    const be = readJson(path.join(BE_MESSAGES_DIR, `${locale}.json`));
    for (const { frontend, backend } of parity) {
      const feVal = fe[frontend];
      const beVal = be[backend];
      if (feVal !== beVal) {
        console.error(
          `[audit] ${locale} parity ${frontend} != ${backend}: fe=${JSON.stringify(feVal)} be=${JSON.stringify(beVal)}`
        );
        ok = false;
      }
    }
  }
  return ok;
}

function auditEmptyAndTokens(locales) {
  let ok = true;
  const tokenRe = /⟦(?:PH_|LIT)/;
  for (const locale of locales) {
    const fe = flatten(readJson(path.join(FE_LOCALES_DIR, `${locale}.json`)));
    const be = readJson(path.join(BE_MESSAGES_DIR, `${locale}.json`));
    for (const [key, val] of Object.entries(fe)) {
      if (!String(val).trim()) {
        console.error(`[audit] ${locale} frontend.${key}: empty value`);
        ok = false;
      }
      if (tokenRe.test(String(val))) {
        console.error(`[audit] ${locale} frontend.${key}: leaked translation token`);
        ok = false;
      }
    }
    for (const [key, val] of Object.entries(be)) {
      if (!String(val).trim()) {
        console.error(`[audit] ${locale} backend.${key}: empty value`);
        ok = false;
      }
      if (tokenRe.test(String(val))) {
        console.error(`[audit] ${locale} backend.${key}: leaked translation token`);
        ok = false;
      }
    }
  }
  return ok;
}

export function auditLocales() {
  const locales = loadLocales();
  const enFeFlat = flatten(readJson(path.join(FE_LOCALES_DIR, 'en.json')));
  const enBe = readJson(path.join(BE_MESSAGES_DIR, 'en.json'));

  let ok = true;
  ok = auditIdenticalToEn(locales, enFeFlat, enBe) && ok;
  ok = auditParity(locales) && ok;
  ok = auditEmptyAndTokens(locales) && ok;
  return ok;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (auditLocales()) {
    console.log('OK: i18n audit passed');
    process.exit(0);
  }
  console.error('i18n audit failed');
  process.exit(1);
}
