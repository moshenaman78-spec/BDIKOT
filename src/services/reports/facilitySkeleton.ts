/**
 * services/reports/facilitySkeleton.ts — שלד אחיד לסוג דוח שעדיין לא הועבר במלואו.
 *
 * מבנה: רשימת מתקנים/לוחות (כרטיס כהה לכל אחד) עם checklist + מדידות + תמונות + הערות.
 * כל נתון ייעודי שמגיע מהאפליקציה הישנה נשמר כמו שהוא תחת legacy (לא נמחק בשמירה).
 */
import type { ReportTypeCode } from '@/core/reportTypes';
import { defineReportService, mergeDefaults, type ReportTypeService } from './ReportTypeService';
import { facilitiesFindings, facilitiesSection, makeFacility, type Facility } from './helpers';

export interface FacilityReportData {
  facilities: Facility[];
  /** שדות מהמבנה הישן שטרם מופו — נשמרים כמו שהם. */
  legacy: Record<string, unknown>;
}

export interface SkeletonOptions {
  sectionTitle: string;
  unitName: string; // "לוח", "עמדה", "כבל"...
  icon?: string;
  defaultChecklist?: readonly string[];
}

export function facilitySkeletonService(code: ReportTypeCode, opts: SkeletonOptions): ReportTypeService<FacilityReportData> {
  const createEmpty = (): FacilityReportData => ({
    facilities: [makeFacility(`${opts.unitName} 1`, opts.defaultChecklist ?? [])],
    legacy: {},
  });
  return defineReportService<FacilityReportData>(code, {
    isSkeleton: true,
    createEmpty,
    normalize: (raw) => {
      const d = mergeDefaults(createEmpty(), raw);
      if (!d.facilities.length) d.facilities = createEmpty().facilities;
      return d;
    },
    validate: (t) =>
      t.facilities.some((f) => !f.name.trim())
        ? [{ path: 'facilities', message: `יש ${opts.unitName} ללא שם`, severity: 'warning' }]
        : [],
    buildSections: (t) => [facilitiesSection('facilities', opts.sectionTitle, opts.icon ?? '🗂️', t.facilities, opts.unitName)],
    findings: (t) => facilitiesFindings(t.facilities, opts.unitName),
  });
}
