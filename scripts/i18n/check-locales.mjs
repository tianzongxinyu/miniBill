#!/usr/bin/env node
/**
 * Verify locale structure + production i18n audit.
 */
import fs from 'node:fs';
import path from 'node:path';
import { auditLocales } from './audit-locales.mjs';
import {
  BE_MESSAGES_DIR,
  FE_LOCALES_DIR,
  extractPlaceholders,
  flatten,
  loadLocales,
  readJson,
} from './lib.mjs';

function checkSet(name, dir, locales, enFlat, isNested) {
  let ok = true;
  for (const locale of locales) {
    const filePath = path.join(dir, `${locale}.json`);
    if (!fs.existsSync(filePath)) {
      console.error(`[structure] ${name} missing: ${filePath}`);
      ok = false;
      continue;
    }
    const data = readJson(filePath);
    const flat = isNested ? flatten(data) : data;
    const enKeys = Object.keys(enFlat).sort();
    const keys = Object.keys(flat).sort();
    if (JSON.stringify(keys) !== JSON.stringify(enKeys)) {
      const missing = enKeys.filter((k) => !(k in flat));
      const extra = keys.filter((k) => !(k in enFlat));
      console.error(`[structure] ${name} ${locale}: key mismatch`);
      if (missing.length) console.error(`  missing: ${missing.join(', ')}`);
      if (extra.length) console.error(`  extra: ${extra.join(', ')}`);
      ok = false;
    }
    for (const key of enKeys) {
      const enPh = extractPlaceholders(enFlat[key]).join(',');
      const locPh = extractPlaceholders(flat[key] ?? '').join(',');
      if (enPh !== locPh) {
        console.error(`[structure] ${name} ${locale}.${key}: placeholder mismatch (en=[${enPh}] got=[${locPh}])`);
        ok = false;
      }
    }
  }
  return ok;
}

const locales = loadLocales();
const enFe = readJson(path.join(FE_LOCALES_DIR, 'en.json'));
const enBe = readJson(path.join(BE_MESSAGES_DIR, 'en.json'));
const enFeFlat = flatten(enFe);

let ok = true;
ok = checkSet('frontend', FE_LOCALES_DIR, locales, enFeFlat, true) && ok;
ok = checkSet('backend', BE_MESSAGES_DIR, locales, enBe, false) && ok;
ok = auditLocales() && ok;

if (ok) {
  console.log(`OK: ${locales.length} locales verified (structure + audit)`);
  process.exit(0);
}
console.error('Locale check failed');
process.exit(1);
