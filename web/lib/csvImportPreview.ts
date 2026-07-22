/** Client-side CSV/TSV preview for import mapping UI. */

export type CsvImportField = 'date' | 'flow' | 'amount' | 'tags' | 'contact' | 'note' | 'balance';

export type CsvColumnMapping = Partial<Record<CsvImportField, string>>;

export type CsvImportPreview = {
  headers: string[];
  sampleRows: string[][];
  delimiter: ',' | '\t' | ';';
  mapping: CsvColumnMapping;
};

const FIELD_ALIASES: Record<CsvImportField, string[]> = {
  date: ['日期', 'Date'],
  flow: ['收支类型', '流向', '类型', 'Flow', 'Type'],
  amount: ['金额', '金額', 'Amount'],
  tags: ['类别', '類別', '分类', '分類', '标签', '標籤', 'Tags', 'Category'],
  contact: ['联系人', '聯繫人', 'Contact'],
  note: ['备注', '備註', '说明', '說明', 'Note', 'Memo'],
  balance: [
    '结余',
    '結餘',
    '账户结余',
    '帳戶結餘',
    '账户余额',
    '帳戶餘額',
    '账户结余(元)',
    '账户结余（元）',
    'Running balance',
    'Balance after',
    '余额',
    '餘額',
  ],
};

/** Order: amount before balance so「金额」wins over bare「余额」ambiguity. */
const IMPORT_FIELDS: CsvImportField[] = [
  'date',
  'flow',
  'amount',
  'tags',
  'contact',
  'note',
  'balance',
];

export function guessCsvMapping(headers: string[]): CsvColumnMapping {
  const used = new Set<number>();
  const mapping: CsvColumnMapping = {};
  for (const field of IMPORT_FIELDS) {
    for (const alias of FIELD_ALIASES[field]) {
      const idx = headers.findIndex(
        (h, i) => !used.has(i) && h.trim().toLowerCase() === alias.trim().toLowerCase()
      );
      if (idx >= 0) {
        used.add(idx);
        mapping[field] = headers[idx].trim();
        break;
      }
    }
  }
  return mapping;
}

export function mappingReady(mapping: CsvColumnMapping): boolean {
  return Boolean(mapping.date && mapping.flow && mapping.amount);
}

function decodeTextFromBuffer(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes);
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes);
  }
  let text = new TextDecoder('utf-8').decode(bytes);
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }
  return text;
}

function sniffDelimiter(firstLine: string): ',' | '\t' | ';' {
  const tabs = (firstLine.match(/\t/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  const semis = (firstLine.match(/;/g) || []).length;
  if (tabs >= commas && tabs >= semis && tabs > 0) return '\t';
  if (semis > commas && semis > tabs) return ';';
  return ',';
}

/** Minimal CSV line splitter supporting quotes. */
function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === delimiter) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function parseRows(text: string, delimiter: string, maxRows: number): string[][] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const rows: string[][] = [];
  for (const line of lines) {
    if (rows.length >= maxRows) break;
    if (line.trim() === '' && rows.length === 0) continue;
    if (line.trim() === '') continue;
    rows.push(splitCsvLine(line, delimiter).map((c) => c.trim()));
  }
  return rows;
}

export async function parseCsvImportPreview(file: File, sampleCount = 5): Promise<CsvImportPreview> {
  const buf = await file.arrayBuffer();
  const text = decodeTextFromBuffer(buf);
  const firstNl = text.search(/\r|\n/);
  const firstLine = firstNl >= 0 ? text.slice(0, firstNl) : text;
  const delimiter = sniffDelimiter(firstLine);
  const rows = parseRows(text, delimiter, sampleCount + 1);
  if (rows.length === 0) {
    throw new Error('empty_csv');
  }
  const headers = rows[0].map((h) => h.replace(/^\ufeff/, '').trim());
  const sampleRows = rows.slice(1, sampleCount + 1);
  return {
    headers,
    sampleRows,
    delimiter,
    mapping: guessCsvMapping(headers),
  };
}

export function mappingToApiPayload(mapping: CsvColumnMapping): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of IMPORT_FIELDS) {
    const v = mapping[field]?.trim();
    if (v) out[field] = v;
  }
  return out;
}
