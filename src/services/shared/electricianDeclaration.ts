/**
 * services/shared/electricianDeclaration.ts — הצהרת החשמלאי המבצע (המנגנון הגנרי של הישנה).
 *
 * שדות ברמה העליונה של report_data, כמו בישן (newState / mergeDefaults / getElectricianDeclarationData):
 *   showElectricianDeclaration (ברירת מחדל true — גם בדוח ישן שאין בו את השדה),
 *   electricianDeclarationText (ריק = נוסח ברירת המחדל), workingElectricianName,
 *   workingElectricianLicenseType, workingElectricianLicenseNo. התאריך = תאריך הבדיקה.
 * ביטול גלובלי: company.hideElectricianDeclaration (הגדרות חברה) — לא מודפסת בשום דוח.
 *
 * שינוי מכוון מהישן: בישן, בסוגים הגנריים, משבצת "חתימת החשמלאי" הציגה את state.settings.signature —
 * החתימה של הבודק מהגדרות החברה. כאן המשבצת נשארת ריקה לחתימה ידנית של החשמלאי.
 */
import type { ReportData } from '@/core/reportModel';

export const ELECTRICIAN_DECLARATION =
  'אני החשמלאי החתום מטה, מצהיר בזאת שמתקן החשמל בוצע על ידי לפי כללי המקצוע והבטיחות הטובים ובהתאם לחוק החשמל ותקנותיו התשי"ד 1954 ותקני מכון התקנים הישראלי הנוגעים למתקני צריכה חשמליים.';

export const LICENSE_TYPES = [
  'חשמלאי מעשי', 'חשמלאי מוסמך', 'חשמלאי ראשי', 'חשמלאי בכיר', 'חשמלאי הנדסאי', 'חשמלאי מהנדס',
  'בודק חשמל סוג 1', 'בודק חשמל סוג 2', 'בודק חשמל סוג 3',
] as const;

export interface ElectricianDeclaration {
  enabled: boolean;
  text: string;
  name: string;
  licenseType: string;
  licenseNo: string;
  date: string;
}

const s = (v: unknown) => (typeof v === 'string' ? v : '');

export function readElectricianDeclaration(data: ReportData): ElectricianDeclaration {
  return {
    enabled: data.showElectricianDeclaration === undefined ? true : Boolean(data.showElectricianDeclaration),
    text: s(data.electricianDeclarationText),
    name: s(data.workingElectricianName),
    licenseType: s(data.workingElectricianLicenseType),
    licenseNo: s(data.workingElectricianLicenseNo),
    date: s(data.meta.date),
  };
}

export type ElectricianField = 'showElectricianDeclaration' | 'electricianDeclarationText' | 'workingElectricianName' | 'workingElectricianLicenseType' | 'workingElectricianLicenseNo';

export function writeElectricianField(data: ReportData, field: ElectricianField, value: string | boolean): void {
  data[field] = value;
}

/** מה שמודפס — null אם כבויה בדוח או מבוטלת בהגדרות החברה. */
export function electricianBlock(data: ReportData, hiddenGlobally: boolean): (ElectricianDeclaration & { text: string }) | null {
  if (hiddenGlobally) return null;
  const d = readElectricianDeclaration(data);
  if (!d.enabled) return null;
  return { ...d, text: d.text.trim() || ELECTRICIAN_DECLARATION };
}
