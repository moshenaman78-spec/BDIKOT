/**
 * services/shared/defectRepair.ts — "הצהרת חשמלאי לתיקון ליקוי" (בישן: לוח חשמל ראשי בלבד).
 *
 * מופיעה אוטומטית כשיש בדוח ליקוי (hasMainPanelDefect בישן: סטטוס "לא תקין" בבדיקה ויזואלית /
 * פריט בדיקה, או אישור חשמול שאינו "מאושר"). שדות ברמה העליונה, כמו בישן:
 * defectRepairDeclarationText, defectRepairElectricianName, defectRepairElectricianLicenseType,
 * defectRepairElectricianLicenseNo, defectRepairDate. שדה ריק מודפס כקו למילוי ידני.
 */
import type { DocumentSection, ReportData } from '@/core/reportModel';
import type { ReportTypeCode } from '@/core/reportTypes';
import { formatDateIL } from './testInstruments';

export const DEFECT_REPAIR_DECLARATION =
  'הריני מצהיר/נו כי הליקוי שצוין בדוח זה תוקן על ידי/נו בהתאם לכללי המקצוע הטובים, בהתאם לחוק החשמל התשי"ד 1954 ותקנותיו ותקני מכון התקנים הישראלי, וכי המתקן נבדק ונמצא תקין ובטוח. אין בהצהרה זו כדי להוות אישור רשמי או תחליף לבדיקה נוספת של בודק מוסמך/מהנדס חשמל בהתאם לדרישות הרשויות.';

export const DEFECT_REPAIR_TYPES: readonly ReportTypeCode[] = ['MAIN_PANEL'];

export type DefectRepairField =
  | 'defectRepairDeclarationText' | 'defectRepairElectricianName' | 'defectRepairElectricianLicenseType'
  | 'defectRepairElectricianLicenseNo' | 'defectRepairDate';

export interface DefectRepair { text: string; name: string; licenseType: string; licenseNo: string; date: string }

const s = (v: unknown) => (typeof v === 'string' ? v : '');

export function readDefectRepair(data: ReportData): DefectRepair {
  return {
    text: s(data.defectRepairDeclarationText), name: s(data.defectRepairElectricianName),
    licenseType: s(data.defectRepairElectricianLicenseType), licenseNo: s(data.defectRepairElectricianLicenseNo), date: s(data.defectRepairDate),
  };
}

export function writeDefectRepairField(data: ReportData, field: DefectRepairField, value: string): void {
  data[field] = value;
}

export function defectRepairSection(data: ReportData): DocumentSection {
  const d = readDefectRepair(data);
  return {
    id: 'defect-repair', zone: 'declaration', title: 'הצהרת חשמלאי לתיקון ליקוי', icon: '🛠️',
    blocks: [{
      kind: 'signoff', title: 'הצהרת חשמלאי לתיקון ליקוי', text: d.text.trim() || DEFECT_REPAIR_DECLARATION,
      person: { name: d.name, licenseType: d.licenseType, licenseNo: d.licenseNo, date: formatDateIL(d.date) },
    }],
  };
}
