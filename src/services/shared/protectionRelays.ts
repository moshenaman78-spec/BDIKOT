/**
 * services/shared/protectionRelays.ts — מודול משותף: ממסרי הגנה (v2.2.505 בישן).
 *
 * משמש את SMA, TRANSFORMER_INSPECTION ו-MAIN_PANEL (RELAY_REPORT_TYPES בישן).
 * הנתונים נשמרים ב-report_data.protectionRelays — אותו מפתח ואותו מבנה כמו בישן, כך ששתי
 * האפליקציות עורכות את אותם ממסרים. הועתק 1:1:
 *   RELAY_CURVES, RELAY_LIBRARY, makeProtectionRelay, relaySelectOptions, relayDipBits,
 *   מפתוח שדות (k.replace(/[^A-Za-z0-9]/g, '>'→'gt', '<'→'lt', אחר→'_')),
 *   buildProtectionRelayBlocks (סינון ממסרים ריקים, יחידה רק אם יחידה אחת, DIP רק לקבוצות שנגעו בהן).
 *
 * כדי להוסיף דגם: רשומה אחת ב-RELAY_LIBRARY (גם כאן וגם בישן — אחרת הישנה תציג אותו כ"אחר").
 */
import type { Block, DocumentSection, ReportData } from '@/core/reportModel';
import type { ReportTypeCode } from '@/core/reportTypes';
import type { Finding, ValidationIssue } from '@/services/reports/ReportTypeService';

export const LEGACY_KEY = 'protectionRelays';
export const RELAY_REPORT_TYPES: readonly ReportTypeCode[] = ['SMA', 'TRANSFORMER_INSPECTION', 'MAIN_PANEL'];

export const RELAY_CURVES = ['DT — זמן קבוע', 'NI — הפוך נורמלי', 'VI — הפוך מאוד', 'EI — הפוך במיוחד', 'LI — הפוך ארוך'] as const;
export const RELAY_STATUS_OPTIONS = ['תקין', 'לא תקין', 'לא נבדק'] as const;

/** [מפתח, תווית, spec?] — spec: יחידה ("A", "×In / A"), או "select:status" / "select:curve" / "select:a|b|c". */
export type RelayField = readonly [key: string, label: string, spec?: string];
export type RelayDip = readonly [key: string, label: string, switches: number];

export interface RelayModel {
  maker: string;
  desc: string;
  info: readonly RelayField[];
  settings: readonly RelayField[];
  dips: readonly RelayDip[];
  extra: readonly RelayField[];
}

export const OTHER_MODEL = 'אחר';

export const RELAY_LIBRARY: Readonly<Record<string, RelayModel>> = {
  'ABB REJ603': {
    maker: 'ABB', desc: 'ממסר הגנה בהזנה עצמית (Self-powered) — זרם יתר וזליגה לאדמה',
    info: [['serial', 'מס׳ סידורי'], ['ctType', 'סוג / טווח משני זרם (CT)'], ['version', 'גרסה / Article no.']],
    settings: [['I>', 'זרם יתר — סף (I>)', '×In / A'], ['t>', 'זמן / מקדם (t> / k)', 's'], ['curve', 'עקומה (I>)', 'select:curve'],
      ['I>>', 'קצר — סף (I>>)', '×In / A'], ['t>>', 'זמן (t>>)', 's'], ['Io>', 'זליגה לאדמה — סף (Io>)', '×In / A'], ['to>', 'זמן (to>)', 's']],
    dips: [['S1', 'DIP S1', 8], ['S2', 'DIP S2', 8], ['S3', 'DIP S3', 8], ['S4', 'DIP S4', 8], ['S5', 'DIP S5', 8], ['S6', 'DIP S6', 8]],
    extra: [['tripTest', 'בדיקת הפעלה (Trip test)', 'select:status'], ['injection', 'בדיקת הזרקה משנית', 'select:status'], ['readyLed', 'נורית Ready / IRF', 'select:status']],
  },
  'Kries IKI-30': {
    maker: 'Kries-Energietechnik', desc: 'ממסר הגנה / מחוון תקלה לתא RMU — זרם יתר, קצר וזליגה לאדמה',
    info: [['serial', 'SN (מס׳ סידורי)'], ['artNr', 'Art-Nr'], ['date', 'תאריך ייצור (Date)'],
      ['coil', 'סליל ניתוק (Parameterisation bridge)', 'select:3V / 0,02Ws|24V / 0,1Ws|External Buffered']],
    settings: [['I>', 'זרם יתר — סף (I>)', 'A'], ['t>', 'זמן (t>)', 's'], ['I>>', 'קצר — סף (I>>)', 'A'], ['t>>', 'זמן (t>>)', 's'], ['Ie>', 'זליגה לאדמה — סף (Ie>)', 'A'], ['te>', 'זמן (te>)', 's']],
    dips: [['A', 'DIP A 1–12 (שמאל)', 12], ['B', 'DIP B 1–5 (אמצע)', 5], ['C', 'DIP C 1–10 (ימין)', 10], ['J', 'Jumper 1–5', 5]],
    extra: [['battery', 'סוללת ליתיום 3.6V', 'select:status'], ['tripTest', 'בדיקת הפעלה (Trip test)', 'select:status'], ['injection', 'בדיקת הזרקה משנית', 'select:status']],
  },
  [OTHER_MODEL]: {
    maker: '', desc: 'ממסר אחר — יצרן, דגם והגדרות חופשיות',
    info: [['maker', 'יצרן'], ['model', 'דגם'], ['serial', 'מס׳ סידורי'], ['ctType', 'משני זרם (CT)']],
    settings: [['I>', 'זרם יתר — סף (I>)', 'A / ×In'], ['t>', 'זמן (t>)', 's'], ['I>>', 'קצר — סף (I>>)', 'A / ×In'], ['t>>', 'זמן (t>>)', 's'], ['Io>', 'זליגה לאדמה — סף', 'A / ×In'], ['to>', 'זמן (to>)', 's']],
    dips: [],
    extra: [['tripTest', 'בדיקת הפעלה (Trip test)', 'select:status'], ['injection', 'בדיקת הזרקה משנית', 'select:status']],
  },
};

export const RELAY_MODEL_NAMES = Object.keys(RELAY_LIBRARY);

export interface ProtectionRelay {
  id: string;
  model: string;
  location: string;
  info: Record<string, string>;
  settings: Record<string, string>;
  /** מפתח קבוצה → מחרוזת סיביות ("10100000"), מתג 1 = התו הראשון. */
  dips: Record<string, string>;
  extra: Record<string, string>;
  notes: string;
  collapsed: boolean;
  [legacyField: string]: unknown;
}

/* ------------------------------ עזרים (1:1 מהישן) ------------------------------ */

/** המפתח שבו ערך השדה נשמר: 'I>' → 'Igt', 'I>>' → 'Igtgt', 't<' → 'tlt'. */
export function fieldKey(k: string): string {
  return k.replace(/[^A-Za-z0-9]/g, (c) => ({ '>': 'gt', '<': 'lt' } as Record<string, string>)[c] ?? '_');
}

export function relaySelectOptions(spec: string): string[] {
  if (spec === 'select:curve') return [...RELAY_CURVES];
  if (spec === 'select:status') return [...RELAY_STATUS_OPTIONS];
  return spec.slice(7).split('|');
}

export const isSelect = (spec?: string): boolean => !!spec && spec.startsWith('select:');

/** מחרוזת באורך n בדיוק: '1' נשאר '1', כל השאר '0'. */
export function relayDipBits(val: unknown, n: number): string {
  const t = String(val ?? '');
  let out = '';
  for (let i = 0; i < n; i++) out += t[i] === '1' ? '1' : '0';
  return out;
}

export function libraryFor(model: string): RelayModel {
  return RELAY_LIBRARY[model] ?? RELAY_LIBRARY[OTHER_MODEL];
}

export function makeRelayId(): string {
  return 'rel_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function makeProtectionRelay(model?: string): ProtectionRelay {
  return { id: makeRelayId(), model: model || 'ABB REJ603', location: '', info: {}, settings: {}, dips: {}, extra: {}, notes: '', collapsed: false };
}

const asRecord = (v: unknown): Record<string, string> =>
  v && typeof v === 'object' && !Array.isArray(v) ? { ...(v as Record<string, string>) } : {};

/** כמו הישן (['info','settings','dips','extra'] → {} אם חסר), בלי למחוק שדות. */
export function normalizeRelay(raw: unknown): ProtectionRelay {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<ProtectionRelay>;
  return {
    ...r,
    id: typeof r.id === 'string' && r.id ? r.id : makeRelayId(),
    model: typeof r.model === 'string' && r.model ? r.model : 'ABB REJ603',
    location: String(r.location ?? ''),
    info: asRecord(r.info), settings: asRecord(r.settings), dips: asRecord(r.dips), extra: asRecord(r.extra),
    notes: String(r.notes ?? ''),
    collapsed: Boolean(r.collapsed),
  };
}

export function readRelays(data: ReportData): ProtectionRelay[] {
  const raw = data[LEGACY_KEY];
  return Array.isArray(raw) ? raw.map(normalizeRelay) : [];
}

export function writeRelays(data: ReportData, relays: ProtectionRelay[]): void {
  data[LEGACY_KEY] = relays;
}

export function relaysApply(code: ReportTypeCode): boolean {
  return RELAY_REPORT_TYPES.includes(code);
}

/* ------------------------------ פעולות עריכה (טהורות) ------------------------------ */

export function addRelay(list: ProtectionRelay[], model: string): ProtectionRelay[] {
  return [...list, makeProtectionRelay(model)];
}

/** שכפול מיד אחרי המקור. שינוי מכוון: id חדש (בישן השכפול הגנרי העתיק גם את ה-id). */
export function duplicateRelay(list: ProtectionRelay[], index: number): ProtectionRelay[] {
  if (!list[index]) return list;
  const next = [...list];
  next.splice(index + 1, 0, { ...structuredClone(list[index]), id: makeRelayId() });
  return next;
}

export function removeRelay(list: ProtectionRelay[], index: number): ProtectionRelay[] {
  return list.filter((_, i) => i !== index);
}

export function toggleDip(relay: ProtectionRelay, groupKey: string, switchIndex: number, n: number): ProtectionRelay {
  const bits = relayDipBits(relay.dips[groupKey], n).split('');
  bits[switchIndex] = bits[switchIndex] === '1' ? '0' : '1';
  return { ...relay, dips: { ...relay.dips, [groupKey]: bits.join('') } };
}

export function relayTitle(r: ProtectionRelay): string {
  return `${r.model}${r.location ? ' — ' + r.location : ''}`;
}

/** שורת סיכום לכרטיס מצומצם (כמו sp-row-sum בישן). */
export function relaySummaryLine(r: ProtectionRelay): string {
  return [r.extra.tripTest ? 'בדיקת הפעלה: ' + r.extra.tripTest : '', r.info.serial ? 'SN: ' + r.info.serial : ''].filter(Boolean).join(' · ') || 'מצומצם';
}

/* ------------------------------ פלט, ליקויים, בדיקות ------------------------------ */

/** ממסר "ריק" לא מודפס (כמו הסינון בישן). */
export function isPrintable(r: ProtectionRelay): boolean {
  return Boolean(r.location || Object.values(r.info).some(Boolean) || Object.values(r.settings).some(Boolean) || Object.values(r.extra).some(Boolean));
}

/** יחידה מוצגת רק כשהיא יחידה אחת (לא "×In / A"), כמו בישן. */
export function displayUnit(spec?: string): string {
  if (!spec || isSelect(spec)) return '';
  return spec.split(' / ')[0] === spec ? spec : '';
}

export function relayBlocks(r: ProtectionRelay): Block[] {
  const lib = libraryFor(r.model);
  const infoRows: Array<{ label: string; value: string }> = [
    { label: 'יצרן', value: lib.maker || r.info.maker || '' },
    ...lib.info.map(([k, label]) => ({ label, value: r.info[fieldKey(k)] ?? '' })),
    ...lib.extra.map(([k, label]) => ({ label, value: r.extra[fieldKey(k)] ?? '' })),
  ].filter((x) => x.value);
  const settingRows = lib.settings
    .map(([k, label, spec]) => [label, r.settings[fieldKey(k)] ?? '', displayUnit(spec)] as const)
    .filter(([, v]) => v);
  const blocks: Block[] = [];
  if (infoRows.length) blocks.push({ kind: 'fields', caption: 'פרטי הממסר ובדיקות', rows: infoRows });
  if (settingRows.length) {
    blocks.push({ kind: 'table', caption: 'הגדרות הגנה', columns: ['הגדרה', 'ערך'], ltrColumns: [1], rows: settingRows.map(([l, v, u]) => [l, u ? `${v} ${u}` : v]) });
  }
  const dips = lib.dips.filter(([k]) => r.dips[k] !== undefined);
  if (dips.length) {
    blocks.push({
      kind: 'table', caption: 'מצב מתגי DIP (■ = ON · □ = OFF, מתג 1 משמאל)', columns: ['קבוצה', 'מצב'], ltrColumns: [1],
      rows: dips.map(([k, label, n]) => [label, relayDipBits(r.dips[k], n).split('').map((b) => (b === '1' ? '■' : '□')).join(' ')]),
    });
  }
  if (r.notes.trim()) blocks.push({ kind: 'paragraph', text: `הערות: ${r.notes.trim()}` });
  return blocks;
}

/** סעיף "ממסרי הגנה" — תוכן (לפני הסיכום), כרטיס לכל ממסר. null אם אין מה להדפיס. */
export function relaysSection(data: ReportData): DocumentSection | null {
  const list = readRelays(data).filter(isPrintable);
  if (!list.length) return null;
  return {
    id: 'protection-relays', zone: 'content', title: 'ממסרי הגנה', icon: '🛡',
    blocks: list.map((r, i) => ({ kind: 'facility' as const, title: `ממסר הגנה #${i + 1}: ${relayTitle(r)}`, subtitle: libraryFor(r.model).maker || undefined, blocks: relayBlocks(r) })),
  };
}

export function relayFindings(data: ReportData): Finding[] {
  return readRelays(data).flatMap((r, i) => {
    const lib = libraryFor(r.model);
    const where = `ממסר #${i + 1}: ${relayTitle(r)}`;
    return lib.extra.filter(([k]) => r.extra[fieldKey(k)] === 'לא תקין').map(([, label]) => ({ where, text: `${label} — לא תקין${r.notes ? ` (${r.notes})` : ''}` }));
  });
}

export function validateRelays(data: ReportData): ValidationIssue[] {
  return readRelays(data).flatMap((r, i) => {
    const issues: ValidationIssue[] = [];
    const p = `${LEGACY_KEY}.${i}`;
    const name = `ממסר #${i + 1} (${r.model})`;
    if (!isPrintable(r)) issues.push({ path: p, message: `${name}: ריק — לא יודפס`, severity: 'warning' });
    else if (!r.location.trim()) issues.push({ path: `${p}.location`, message: `${name}: חסר מיקום (לוח / תא / ממיר)`, severity: 'warning' });
    if (!RELAY_LIBRARY[r.model]) issues.push({ path: `${p}.model`, message: `${name}: דגם לא מוכר — מוצג כ"אחר"`, severity: 'warning' });
    const lib = libraryFor(r.model);
    if (lib.extra.some(([k]) => r.extra[fieldKey(k)] === 'לא תקין') && !r.notes.trim())
      issues.push({ path: `${p}.notes`, message: `${name}: בדיקה סומנה "לא תקין" בלי הערה`, severity: 'warning' });
    return issues;
  });
}
