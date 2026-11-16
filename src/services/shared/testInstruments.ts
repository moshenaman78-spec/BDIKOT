/**
 * services/shared/testInstruments.ts — מכשירי בדיקה לעמוד השער (meta.testInstrumentsSelected בישן).
 *
 * בחירה מהירה מרשימה קבועה + "אחר" (meta.testInstrumentsOther). בעמוד השער כל מכשיר מוצג עם
 * דגם, מס' סידורי ותוקף כיול מטבלת equipment בענן (קריאה בלבד, status='active'), כמו
 * instrumentDetailsText / findMatchingEquipment בישן. תוקף כיול: פג / פחות מ-60 יום → אזהרה.
 */
import type { ReportData } from '@/core/reportModel';
import type { ValidationIssue } from '@/services/reports/ReportTypeService';
import { getSupabase } from '@/services/supabaseClient';

export const TEST_INSTRUMENT_QUICK_OPTIONS = [
  'מכשיר משולב MI3155', 'מכשיר משולב', 'מכשיר בדיקת התנגדות נמוכה', 'גשר', 'צבת זרם', 'SONEL', 'צבת מגר אדמה FLOKE',
  'מכשיר בדיקה HT', 'גשר עד 800V', 'אחר',
] as const;

export interface Equipment { id: string; name: string; model: string; serialNo: string; calibrationDate: string }

export function normalizeEquipmentRow(row: Record<string, unknown>): Equipment {
  const s = (v: unknown) => (typeof v === 'string' ? v : '');
  return { id: s(row.id), name: s(row.name), model: s(row.model), serialNo: s(row.serial_no), calibrationDate: s(row.calibration_date) };
}

export async function loadEquipment(): Promise<Equipment[]> {
  const { data, error } = await getSupabase().from('equipment').select('id, name, model, serial_no, calibration_date').eq('status', 'active').order('name');
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(normalizeEquipmentRow);
}

export function readSelectedInstruments(data: ReportData): string[] {
  const v = data.meta.testInstrumentsSelected;
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/** קודם התאמה מדויקת לשם, אחר כך הכלה (בשני הכיוונים) — כמו בישן. */
export function findMatchingEquipment(name: string, pool: Equipment[]): Equipment | null {
  if (!name || name === 'אחר') return null;
  const exact = pool.find((e) => e.name === name);
  if (exact) return exact;
  const needle = name.toLowerCase();
  return pool.find((e) => { const hay = (e.name || '').toLowerCase(); return !!hay && (hay.includes(needle) || needle.includes(hay)); }) ?? null;
}

export function formatDateIL(iso: string): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${Number(m[3])}.${Number(m[2])}.${m[1]}` : iso;
}

export type CalibrationStatus = 'ok' | 'warning' | 'expired' | null;

export function calibrationStatus(date: string, today: Date = new Date()): CalibrationStatus {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date || '');
  if (!m) return null;
  const cal = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const t = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const daysLeft = Math.round((cal - t) / 86400000);
  if (daysLeft < 0) return 'expired';
  if (daysLeft <= 60) return 'warning';
  return 'ok';
}

/** שורת מכשיר לעמוד השער. */
export function instrumentDetailsText(name: string, pool: Equipment[], otherText: string): string {
  const label = name === 'אחר' ? otherText || 'אחר' : name;
  const eq = findMatchingEquipment(name, pool);
  if (name === 'אחר' && !eq) return label;
  const parts: string[] = [];
  if (eq && eq.model && eq.model !== label) parts.push(`דגם ${eq.model}`);
  parts.push(`מס' סידורי: ${eq?.serialNo || '—'}`);
  parts.push(`תוקף כיול: ${eq?.calibrationDate ? formatDateIL(eq.calibrationDate) : '—'}`);
  return `${label} — ${parts.join(' · ')}`;
}

export function instrumentsCoverText(data: ReportData, pool: Equipment[]): string {
  const other = typeof data.meta.testInstrumentsOther === 'string' ? data.meta.testInstrumentsOther : '';
  return readSelectedInstruments(data).map((n) => instrumentDetailsText(n, pool, other)).join('\n');
}

export function validateInstruments(data: ReportData, pool: Equipment[], today: Date = new Date()): ValidationIssue[] {
  const selected = readSelectedInstruments(data);
  if (!selected.length) return [{ path: 'meta.testInstrumentsSelected', message: 'לא נבחרו מכשירי בדיקה (מופיעים בעמוד השער)', severity: 'warning' }];
  return selected.flatMap((name): ValidationIssue[] => {
    const eq = findMatchingEquipment(name, pool);
    const st = eq ? calibrationStatus(eq.calibrationDate, today) : null;
    if (st === 'expired') return [{ path: 'meta.testInstrumentsSelected', message: `תוקף הכיול של "${name}" פג (${formatDateIL(eq!.calibrationDate)})`, severity: 'error' }];
    if (st === 'warning') return [{ path: 'meta.testInstrumentsSelected', message: `תוקף הכיול של "${name}" פג בקרוב (${formatDateIL(eq!.calibrationDate)})`, severity: 'warning' }];
    return [];
  });
}
