/**
 * services/sync/diffLabels.ts — "השווה שינויים" בשפה של הבודק, לא בנתיבים טכניים.
 *
 * meta.client → "מזמין הבדיקה";
 * transformerInspectionReport.transformers.0.checklist.3.status → "שנאי 1 · מצב בידודים (Bushings)… · סטטוס".
 * ערכים: תמונות (data:) לא מוצגות כמחרוזת ארוכה, אובייקט שלם שנוסף/נמחק מסוכם, טקסט ארוך נחתך.
 */
import type { FieldDiff } from './saveRules';
import { TI_CHECKLIST, TI_INSULATION_TESTS, TI_STATUS_LABEL } from '@/services/reports/types/transformerInspection.service';
import { RELAY_LIBRARY, fieldKey } from '@/services/shared/protectionRelays';

const META: Record<string, string> = {
  client: 'מזמין הבדיקה', attentionTo: 'לידי (איש קשר)', siteName: 'שם המתקן', address: 'מיקום המתקן', project: 'פרויקט',
  date: 'תאריך הבדיקה', issueDate: 'תאריך הפקת הדוח', description: 'תיאור המתקן/העבודה', reportNumber: 'מספר דוח',
  testInstrumentsSelected: 'מכשירי בדיקה', testInstrumentsOther: 'מכשיר בדיקה אחר',
};
const TOP: Record<string, string> = {
  approvalStatus: 'אישור חשמול', customDeclaration: 'הצהרה נוספת', showElectricianDeclaration: 'הצגת הצהרת חשמלאי',
  electricianDeclarationText: 'נוסח הצהרת החשמלאי', workingElectricianName: 'שם החשמלאי המבצע',
  workingElectricianLicenseType: 'סוג רישיון החשמלאי', workingElectricianLicenseNo: 'מס׳ רישיון החשמלאי',
};
const TRANSFORMER: Record<string, string> = {
  serialNo: 'מספר סידורי', model: 'דגם', manufacturer: 'יצרן', powerKVA: 'הספק (kVA)', primaryVoltageKV: 'מתח ראשוני',
  secondaryVoltageV: 'מתח משני', connectionGroup: 'קבוצת חיבור', yearOfManufacture: 'שנת ייצור', transformerType: 'סוג שנאי',
  shortCircuitVoltagePercent: 'Uk%', checklistEnabled: 'בדיקות ויזואליות (הפעלה)', insulationEnabled: 'בדיקת בידוד (הפעלה)',
  sectionNotes: 'הערות לשנאי', num: 'מספר', id: 'מזהה',
};
const GROUNDING: Record<string, string> = { parallelConductors: 'מוליכים במקביל', crossSection: 'חתך מוליך', conductorType: 'סוג מוליך' };
const SUB: Record<string, string> = { status: 'סטטוס', notes: 'הערה', value: 'ערך', enabled: 'מסומן' };
const PHOTO: Record<string, string> = { title: 'כותרת', caption: 'כיתוב', dataUrl: 'קובץ', cloudPath: 'קובץ בענן', pendingUpload: 'ממתינה להעלאה' };
const RELAY: Record<string, string> = { model: 'דגם', location: 'מיקום', notes: 'הערות', collapsed: 'מצומצם' };

const n = (s: string | undefined) => Number(s) + 1;

function relayFieldLabel(group: string, key: string): string {
  for (const model of Object.values(RELAY_LIBRARY)) {
    const list = group === 'info' ? model.info : group === 'settings' ? model.settings : group === 'extra' ? model.extra : [];
    const hit = list.find(([k]) => fieldKey(k) === key);
    if (hit) return hit[1];
    if (group === 'dips') { const d = model.dips.find(([k]) => k === key); if (d) return d[1]; }
  }
  return key;
}

export function labelForPath(path: string): string {
  const p = path.split('.');
  const [a, b, c, d, e, f] = p;
  if (a === 'meta') return META[b] ?? `פרטים: ${b}`;
  if (a === 'notes' && b !== undefined) return `הערה ${n(b)}`;
  if (TOP[a]) return TOP[a];
  if (a === 'generalPhotos' && b !== undefined) {
    if (c === undefined) return `תמונה ${n(b)}`;
    if (c === 'notes') return d !== undefined ? `תמונה ${n(b)} · הערה ${n(b)}.${n(d)}` : `תמונה ${n(b)} · הערות`;
    return `תמונה ${n(b)} · ${PHOTO[c] ?? c}`;
  }
  if (a === 'protectionRelays' && b !== undefined) {
    const base = `ממסר #${n(b)}`;
    if (c === undefined) return base;
    if (['info', 'settings', 'extra', 'dips'].includes(c) && d) return `${base} · ${relayFieldLabel(c, d)}`;
    return `${base} · ${RELAY[c] ?? c}`;
  }
  if (a === 'transformerInspectionReport') {
    if (b === 'transformers' && c !== undefined) {
      const base = `שנאי ${n(c)}`;
      if (d === undefined) return base;
      if (d === 'checklist' && e !== undefined) return `${base} · ${TI_CHECKLIST[Number(e)] ?? `בדיקה ${n(e)}`}${f ? ` · ${SUB[f] ?? f}` : ''}`;
      if (d === 'insulationTests' && e !== undefined) return `${base} · בידוד ${TI_INSULATION_TESTS[Number(e)]?.label ?? n(e)}${f ? ` · ${SUB[f] ?? f}` : ''}`;
      if ((d === 'groundingMethod' || d === 'groundingProtection') && e) return `${base} · ${d === 'groundingMethod' ? 'הארקת שיטה' : 'הארקת הגנה'} · ${GROUNDING[e] ?? e}`;
      return `${base} · ${TRANSFORMER[d] ?? d}`;
    }
    if (b === 'summaryItems' && c !== undefined) return `ממצא מסכם ${n(c)}`;
    if (b === 'conclusion') return c === 'freeText' ? 'מסקנה · הרחבה' : 'מסקנה';
    if (b === 'transformers') return 'רשימת השנאים';
  }
  return path;
}

/** ערך להצגה — קצר וקריא. */
export function displayValue(v: unknown, path = ''): string {
  if (v === undefined || v === null || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'כן' : 'לא';
  if (typeof v === 'string') {
    if (v.startsWith('data:')) return '[תמונה]';
    if (/\.status$/.test(path) && TI_STATUS_LABEL[v]) return TI_STATUS_LABEL[v];
    return v.length > 120 ? v.slice(0, 117) + '…' : v;
  }
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) {
    if (v.every((x) => typeof x === 'string')) return displayValue((v as string[]).join(', '));
    return `${v.length} פריטים`;
  }
  return 'פריט שלם';
}

export interface ReadableDiff { label: string; local: string; cloud: string; kind: 'changed' | 'added-here' | 'only-in-cloud' }

/** מאחד ומתרגם; שדות טכניים (מזהים, קובץ תמונה כפול) מוסתרים כשיש שינוי קריא באותו פריט. */
export function readableDiff(diffs: FieldDiff[]): ReadableDiff[] {
  const hidden = /\.(id|num|collapsed|uploadedAt|mimeType|fileName)$/;
  return diffs
    .filter((d) => !hidden.test(d.path))
    .map((d) => {
      const kind: ReadableDiff['kind'] = d.cloud === undefined ? 'added-here' : d.local === undefined ? 'only-in-cloud' : 'changed';
      return { label: labelForPath(d.path), local: displayValue(d.local, d.path), cloud: displayValue(d.cloud, d.path), kind };
    })
    // אותה תווית פעמיים (dataUrl + cloudPath של אותה תמונה) — פעם אחת
    .filter((d, i, arr) => arr.findIndex((x) => x.label === d.label && x.local === d.local && x.cloud === d.cloud) === i);
}
