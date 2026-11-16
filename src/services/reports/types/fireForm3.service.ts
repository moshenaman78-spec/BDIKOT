/**
 * FIRE_FORM3 — טופס 3: אישור תקינות מערכת חשמל ותאורת חירום (כבאות והצלה).
 * טופס רשמי: PDF עצמאי בלי הלוגו והפוטר של החברה (documentKind = 'official-form').
 * מבנה הנתונים הועתק מ-makeFireForm3 / makeF3Panel באפליקציה הישנה (v2.2.525).
 */
import { localIsoDate } from '@/services/sync/editorRules';
import type { DocumentSection } from '@/core/reportModel';
import { defineReportService, mergeDefaults } from '../ReportTypeService';
import { fieldsBlock } from '../helpers';

export const F3_ELEC_OPTIONS = ['נמצאו תקינים בהתאם לחוק החשמל', 'נמצאו לא תקינים בהתאם לחוק החשמל'] as const;
export const F3_EMERG_OPTIONS = ['קיים מפסק חשמל חירום תקין', 'קיים מפסק חשמל חירום לא תקין', 'לא קיים מפסק חשמל חירום'] as const;
export const F3_UPS_OPTIONS = ['קיים מפסק UPS תקין', 'קיים מפסק UPS לא תקין', 'לא קיים מפסק UPS'] as const;
/** סדר במילוי; בטבלת ה-PDF: ניתוק | גילוי | כיבוי */
export const F3_PANEL_FLAGS = [['detection', 'גילוי'], ['disconnect', 'ניתוק'], ['extinguish', 'כיבוי']] as const;
export const F3_AMP_OPTIONS = ['3x25A', '3x40A', '3x63A', '3x80A', '3x100A', '3x125A', '3x160A', '3x200A', '3x250A', '3x400A', '3x630A', '3x800A', '3x1000A', '3x1250A', '3x1600A', '3x2000A', '3x2500A', '3x3000A', '1x25A', '1x40A'] as const;
export const F3_PANELS_PER_PAGE = 20;

export interface F3Panel {
  name: string; location: string; amperage: string;
  detection: string; disconnect: string; extinguish: string;
}

export interface FireForm3Data {
  fireFileNumber: string; facilityName: string; businessType: string; companyId: string;
  city: string; street: string; houseNumber: string; zipCode: string; poBox: string;
  contactName: string; contactRole: string; contactPhone: string; contactEmail: string;
  inspectorName: string; inspectorId: string; licenseType: string; inspectorLicense: string;
  inspectorLicenseValidity: string; inspectionDate: string; inspectorPhone: string; reportDate: string;
  electricalSystemStatus: string; electricalSystemExplanation: string;
  emergencyBreakerStatus: string; emergencyBreakerLocation: string; emergencyBreakerExplanation: string;
  upsStatus: string; upsLocation: string; upsExplanation: string;
  panels: F3Panel[];
}

export const makeF3Panel = (): F3Panel => ({ name: '', location: '', amperage: '', detection: '', disconnect: '', extinguish: '' });

const createEmpty = (): FireForm3Data => ({
  fireFileNumber: '', facilityName: '', businessType: '', companyId: '', city: '', street: '', houseNumber: '', zipCode: '', poBox: '',
  contactName: '', contactRole: '', contactPhone: '', contactEmail: '',
  inspectorName: '', inspectorId: '', licenseType: '', inspectorLicense: '', inspectorLicenseValidity: '', inspectionDate: '', inspectorPhone: '', reportDate: '',
  electricalSystemStatus: '', electricalSystemExplanation: '', emergencyBreakerStatus: '', emergencyBreakerLocation: '', emergencyBreakerExplanation: '',
  upsStatus: '', upsLocation: '', upsExplanation: '', panels: [makeF3Panel()],
});

const needsExplanation = (status: string) => /לא תקין|לא קיים/.test(status);

export const fireForm3Service = defineReportService<FireForm3Data>('FIRE_FORM3', {
  createEmpty,
  normalize: (raw) => {
    const f = mergeDefaults(createEmpty(), raw);
    if (!f.panels.length) f.panels = [makeF3Panel()];
    if (!f.reportDate) f.reportDate = localIsoDate();
    return f;
  },
  validate: (f) => {
    const issues = [];
    if (!f.facilityName) issues.push({ path: 'facilityName', message: 'חסר שם העסק', severity: 'error' as const });
    if (!f.electricalSystemStatus) issues.push({ path: 'electricalSystemStatus', message: 'לא נבחר מצב מערכת החשמל (סעיף 1)', severity: 'error' as const });
    if (needsExplanation(f.electricalSystemStatus) && !f.electricalSystemExplanation)
      issues.push({ path: 'electricalSystemExplanation', message: 'נדרש פירוט לסעיף 1', severity: 'error' as const });
    if (needsExplanation(f.emergencyBreakerStatus) && !f.emergencyBreakerExplanation)
      issues.push({ path: 'emergencyBreakerExplanation', message: 'נדרש פירוט למפסק החירום', severity: 'warning' as const });
    return issues;
  },
  buildSections: (f): DocumentSection[] => [
    {
      id: 'f3-business', zone: 'content', title: 'פרטי העסק', blocks: [fieldsBlock([
        ['מספר תיק כבאות', f.fireFileNumber], ['שם העסק', f.facilityName], ['סוג העסק', f.businessType], ['ח"פ', f.companyId],
        ['כתובת', [f.street, f.houseNumber, f.city].filter(Boolean).join(' ')], ['מיקוד', f.zipCode], ['ת.ד.', f.poBox],
        ['איש קשר', [f.contactName, f.contactRole].filter(Boolean).join(' — ')], ['טלפון', f.contactPhone], ['דוא"ל', f.contactEmail],
      ])],
    },
    {
      id: 'f3-inspector', zone: 'content', title: 'פרטי הבודק', blocks: [fieldsBlock([
        ['שם', f.inspectorName], ['ת"ז', f.inspectorId], ['סוג רישיון', f.licenseType], ['מספר רישיון', f.inspectorLicense],
        ['תוקף', f.inspectorLicenseValidity], ['תאריך בדיקה', f.inspectionDate], ['טלפון', f.inspectorPhone],
      ])],
    },
    {
      id: 'f3-status', zone: 'content', title: 'סעיפים 1–2', blocks: [fieldsBlock([
        ['1. מערכת החשמל', f.electricalSystemStatus], ['פירוט', f.electricalSystemExplanation],
        ['2. מפסק חירום', f.emergencyBreakerStatus], ['מיקום', f.emergencyBreakerLocation], ['פירוט', f.emergencyBreakerExplanation],
        ['UPS', f.upsStatus], ['מיקום UPS', f.upsLocation], ['פירוט UPS', f.upsExplanation],
      ])],
    },
    {
      id: 'f3-panels', zone: 'content', title: 'פירוט לוחות', blocks: [{
        kind: 'table', columns: ['#', 'שם הלוח', 'מיקום', 'זרם', 'ניתוק', 'גילוי', 'כיבוי'],
        rows: f.panels.map((p, i) => [String(i + 1), p.name, p.location, p.amperage, p.disconnect, p.detection, p.extinguish]),
      }],
    },
  ],
  findings: (f) => [
    ...(f.electricalSystemStatus.includes('לא תקינים') ? [{ where: 'מערכת החשמל', text: f.electricalSystemExplanation || f.electricalSystemStatus }] : []),
    ...(needsExplanation(f.emergencyBreakerStatus) ? [{ where: 'מפסק חירום', text: f.emergencyBreakerExplanation || f.emergencyBreakerStatus }] : []),
  ],
});
