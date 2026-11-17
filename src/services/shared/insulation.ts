/**
 * services/shared/insulation.ts — טבלת בדיקות בידוד (insulationTable / printInsulationTable בישן).
 *
 * 3 שורות קבועות (INSULATION_ROWS), שלוש שיטות:
 *   dar  — R15 שנ׳ / R60 שנ׳ → DAR = R60/R15   (סף: <1.0 לא תקין, <1.25 נדרש בדיקה נוספת)
 *   pi   — R1 דק׳ / R10 דק׳ → PI = R10/R1      (סף: <1.0 לא תקין, <2.0 נדרש בדיקה נוספת)
 *   spot — ערך בודד + טמפרטורה → מתוקן ל-20°C (חצייה בכל 10°C), סיווג ידני
 * מבנה שורה זהה לישן: { r15, r60, dar, note, manualClassification, unit, temp }.
 * הערכים r15/r60 נשמרים בשדות האלה גם ב-PI (כמו בישן — רק התוויות משתנות).
 */
import type { Block } from '@/core/reportModel';
import type { Finding } from '@/services/reports/ReportTypeService';

export const INSULATION_ROWS = ['מתח גבוה להארקה', 'מתח נמוך להארקה', 'בין מתח גבוה לנמוך'] as const;
export const INSULATION_UNITS = ['Ω', 'kΩ', 'MΩ', 'GΩ', 'TΩ'] as const;
export const INSULATION_REFERENCE_TEMP_C = 20;
export const DAR_THRESHOLDS = { bad: 1.0, questionable: 1.25 };
export const PI_THRESHOLDS = { bad: 1.0, questionable: 2.0 };
export const MANUAL_CLASSIFICATIONS = ['תקין', 'לא תקין', 'נדרש לטפל'] as const;

export type InsulationMethod = 'dar' | 'pi' | 'spot';
export const INSULATION_METHODS: ReadonlyArray<{ value: InsulationMethod; label: string }> = [
  { value: 'dar', label: 'DAR — יחס R60/R15 שניות (בדיקה מהירה)' },
  { value: 'pi', label: "PI — יחס R10/R1 דקות (בדיקה מלאה, 10 דק')" },
  { value: 'spot', label: 'בדיקה רגילה — ערך בודד עם תיקון טמפרטורה' },
];

export interface InsulationRow {
  r15: string; r60: string; dar: string; note: string; manualClassification: string; unit: string; temp: string;
  [legacyField: string]: unknown;
}
export interface InsulationTable { rows: InsulationRow[]; testMethod: InsulationMethod | string; [legacyField: string]: unknown }

export const makeInsulationRow = (): InsulationRow => ({ r15: '', r60: '', dar: '', note: '', manualClassification: '', unit: 'MΩ', temp: '' });
export const makeInsulationTable = (): InsulationTable => ({ rows: INSULATION_ROWS.map(makeInsulationRow), testMethod: 'dar' });

export function normalizeInsulationTable(raw: unknown): InsulationTable {
  const t = (raw && typeof raw === 'object' ? raw : {}) as Partial<InsulationTable>;
  const rows = Array.isArray(t.rows) ? t.rows : [];
  return {
    ...t,
    testMethod: t.testMethod === 'pi' || t.testMethod === 'spot' ? t.testMethod : 'dar',
    rows: INSULATION_ROWS.map((_, i) => ({ ...makeInsulationRow(), ...(rows[i] && typeof rows[i] === 'object' ? rows[i] : {}) })),
  };
}

export interface InsulationClass { label: string; tone: 'ok' | 'warn' | 'bad' }

export function classifyRatio(method: string, value: number | null): InsulationClass | null {
  if (value === null || Number.isNaN(value)) return null;
  const t = method === 'pi' ? PI_THRESHOLDS : DAR_THRESHOLDS;
  if (value < t.bad) return { label: 'לא תקין', tone: 'bad' };
  if (value < t.questionable) return { label: 'נדרש בדיקה נוספת', tone: 'warn' };
  return { label: 'תקין', tone: 'ok' };
}

export function correctForTemperature(measured: number, tempC: number): number | null {
  if (Number.isNaN(measured) || Number.isNaN(tempC)) return null;
  return measured * Math.pow(2, (tempC - INSULATION_REFERENCE_TEMP_C) / 10);
}

const num = (s: string) => parseFloat(String(s ?? '').replace(',', '.'));

export interface InsulationComputed {
  labels: { v1: string; v2: string; ratio: string };
  /** תוצאה מחושבת (יחס או ערך מתוקן) כטקסט. */
  result: string;
  auto: InsulationClass | null;
}

export function methodLabels(method: string) {
  const isPI = method === 'pi', isSpot = method === 'spot';
  return {
    v1: isSpot ? 'ערך נמדד' : isPI ? 'R (1 דקה)' : "R (15 שנ')",
    v2: isSpot ? 'טמפרטורה (°C)' : isPI ? 'R (10 דקות)' : "R (60 שנ')",
    ratio: isSpot ? `מתוקן ל-${INSULATION_REFERENCE_TEMP_C}°C` : isPI ? 'PI' : 'DAR',
  };
}

export function computeRow(method: string, r: InsulationRow): InsulationComputed {
  const labels = methodLabels(method);
  if (method === 'spot') {
    const c = correctForTemperature(num(r.r15), num(r.temp));
    return { labels, result: c !== null ? `${c.toFixed(2)} ${r.unit || 'MΩ'}` : '—', auto: null };
  }
  const v1 = num(r.r15), v2 = num(r.r60);
  const ratio = !Number.isNaN(v1) && !Number.isNaN(v2) && v1 > 0 ? v2 / v1 : null;
  return { labels, result: ratio !== null ? ratio.toFixed(2) : '—', auto: classifyRatio(method, ratio) };
}

export function rowHasData(r: InsulationRow): boolean {
  return Boolean(r.r15 || r.r60 || r.note || r.manualClassification);
}

/** טבלה להדפסה — רק שורות עם נתונים (כמו בישן); null אם אין. */
export function insulationBlock(t: InsulationTable, caption = 'בדיקות בידוד'): Block | null {
  const method = String(t.testMethod);
  const labels = methodLabels(method);
  const rows = t.rows.map((r, i) => ({ r, i })).filter(({ r }) => rowHasData(r)).map(({ r, i }) => {
    const unit = r.unit || 'MΩ';
    const c = computeRow(method, r);
    const v1 = r.r15 ? `${r.r15} ${unit}` : '—';
    const v2 = method === 'spot' ? (r.temp ? `${r.temp}°C` : '—') : r.r60 ? `${r.r60} ${unit}` : '—';
    const result = c.auto ? `${c.auto.label} (${c.result})` : c.result;
    const note = [r.manualClassification, r.note].filter(Boolean).join(' — ');
    return [INSULATION_ROWS[i], v1, v2, result, note];
  });
  if (!rows.length) return null;
  return { kind: 'table', caption, columns: ['', labels.v1, labels.v2, labels.ratio, 'סיווג / הערות'], ltrColumns: [1, 2], rows };
}

/** ליקויים: סיווג אוטומטי "לא תקין" או סיווג ידני "לא תקין"/"נדרש לטפל". */
export function insulationFindings(t: InsulationTable, where: string): Finding[] {
  const method = String(t.testMethod);
  return t.rows.flatMap((r, i) => {
    const c = computeRow(method, r);
    const bad = c.auto?.tone === 'bad' || r.manualClassification === 'לא תקין' || r.manualClassification === 'נדרש לטפל';
    return bad ? [{ where, text: `בדיקת בידוד ${INSULATION_ROWS[i]}: ${c.auto?.label ?? r.manualClassification}${c.result !== '—' ? ` (${c.labels.ratio} ${c.result})` : ''}` }] : [];
  });
}
