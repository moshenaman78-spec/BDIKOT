/**
 * core/reportModel.ts — מודל הנתונים המשותף לכל סוגי הדוחות.
 *
 * report_data בענן הוא ה-state המלא של האפליקציה הישנה (state.meta / state.settings / ...).
 *
 * כלל תאימות מחייב: מקור האמת הוא המפתחות של האפליקציה הישנה, בשמות ובמבנה שלה.
 * הסיבות (נבדקו מול mergeDefaults בישן, v2.2.552):
 *   - הישנה לא קוראת מפתחות שהיא לא מכירה (typeData וכו') — עריכה בחדשה לא תיראה שם.
 *   - בתוך אובייקט של סוג דוח (למשל transformerInspectionReport וכל שנאי בו) הישנה עושה
 *     deepMergeGeneric — שמשאיר רק מפתחות שקיימים בברירת המחדל שלה. שדה חדש שם יימחק
 *     בשמירה הבאה מהישנה. (ברמה העליונה היא עושה Object.assign ושומרת מפתחות לא מוכרים.)
 *   - שם זהה במבנה שונה שובר את הישנה (למשל notes הוא מערך מחרוזות, לא אובייקטים).
 * לכן typeData קיים רק כמעבר לסוגים שעדיין שלד.
 */
import type { ReportTypeCode } from './reportTypes';

/** state.meta באפליקציה הישנה — פרטים כלליים. */
export interface ReportMeta {
  reportNumber: string;
  date: string; // YYYY-MM-DD
  client: string;
  siteName: string;
  address: string;
  project: string;
  description: string;
  [extra: string]: unknown;
}

/** חלק מ-state.settings שרלוונטי לזהות ולסנכרון. */
export interface ReportSettingsSync {
  formTypeName: string;
  cloudReportId: string | null;
  cloudKnownUpdatedAt: string | null;
  cloudInsertPending: boolean;
  cloudEditSeq: number;
  cloudSyncedSeq: number;
  savedByDevice: string | null;
  cloudClientId: string | null;
  cloudProjectId: string | null;
  [extra: string]: unknown;
}

export interface ReportData {
  meta: ReportMeta;
  settings: ReportSettingsSync;
  /** state.notes — הערות ידניות, מערך מחרוזות (ברירת מחדל [""]); מוצגות ממוספרות. */
  notes: string[];
  /** state.customDeclaration — הצהרה נוספת חופשית אחרי 5 ההצהרות הקבועות. */
  customDeclaration?: string;
  /**
   * מעבר בלבד — לסוגים שעדיין אין להם legacyKey בשירות. האפליקציה הישנה לא קוראת את המפתח,
   * כך שעריכה כאן לא תיראה שם; סוג שהועבר עד הסוף כותב למפתח הישן שלו (למשל transformerInspectionReport).
   */
  typeData?: Record<string, unknown>;
  [legacyField: string]: unknown;
}

/** DECLARATIONS באפליקציה הישנה — "הערות בודק" קבועות, מודפסות תמיד בכל סוגי הדוח. */
export const FIXED_DECLARATIONS = [
  'מתקן החשמל נבדק עפ"י חוק החשמל ותקנותיו.',
  'היתר הבדיקה מתייחס למתקן וללוחות כפי שהיו קיימים במועד הבדיקה.',
  'כל שינוי עתידי במתקן מבטל את ההיתר הנוכחי ומחייב בדיקה נוספת.',
  'לא נבדק ציוד חשמלי מטלטל ומכשירים המחוברים באמצעות תקע.',
  'תוצאות הבדיקה תקפות ליום הבדיקה ואין הבודק אחראי לכל שינוי שלאחר הבדיקה.',
] as const;

/** שורה בטבלת reports ב-Supabase. */
export interface ReportRow {
  id: string;
  project_id: string | null;
  client_id: string | null;
  report_number: string | null;
  report_type: string | null;
  report_title: string | null;
  status: 'draft' | 'final' | 'archived' | 'deleted' | string;
  inspection_date: string | null;
  report_data: ReportData;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  previous_status: string | null;
}

export interface ReportVersionRow {
  id: string;
  report_id: string;
  version_number: number;
  report_data: ReportData;
  created_by: string | null;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/* מודל מסמך (תבנית העיצוב) — מה ששירות הדוח מחזיר כדי לרנדר/להדפיס   */
/* ------------------------------------------------------------------ */

/**
 * אזורי הדוח, לפי הסדר המחייב:
 *   facility → content (לוחות/מתקנים + כל הטקסט) → summary → notes → declaration → signature
 */
export const SECTION_ZONES = ['facility', 'content', 'summary', 'notes', 'declaration', 'signature'] as const;
export type SectionZone = (typeof SECTION_ZONES)[number];

export type Block =
  | { kind: 'fields'; rows: Array<{ label: string; value: string }>; caption?: string }
  | { kind: 'table'; columns: string[]; rows: string[][]; caption?: string; /** אינדקסי עמודות שמוצגות משמאל לימין (ערכים+יחידות, מתגי DIP). */ ltrColumns?: number[] }
  | { kind: 'checklist'; items: Array<{ label: string; status: 'ok' | 'bad' | 'na' | 'pending'; note?: string }> }
  | { kind: 'paragraph'; text: string }
  | { kind: 'notes'; items: string[] }
  | { kind: 'photos'; items: Array<{ storagePath: string; caption?: string }> }
  | { kind: 'facility'; title: string; subtitle?: string; blocks: Block[] };

export interface DocumentSection {
  id: string;
  zone: SectionZone;
  title: string;
  icon?: string;
  /** "01", "02"... — נקבע ע"י orderSections, לא ע"י השירות. */
  number?: string;
  blocks: Block[];
}

export interface ReportDocument {
  typeCode: ReportTypeCode;
  title: string;
  /** מוצג פעם אחת בלבד — בכותרת העמוד (Letterhead). */
  reportNumber: string;
  inspectionDate: string;
  /** ISO — מוצג כ"עודכן לאחרונה: dd.mm.yyyy hh:mm". */
  lastUpdatedAt: string | null;
  documentKind: 'company-letterhead' | 'official-form';
  sections: DocumentSection[];
}

/** ממיין סעיפים לפי אזור (יציב בתוך אזור) ומספר אותם 01, 02, ... */
export function orderSections(sections: DocumentSection[]): Array<DocumentSection & { number: string }> {
  const rank = (z: SectionZone) => SECTION_ZONES.indexOf(z);
  return sections
    .map((s, i) => ({ s, i }))
    .sort((a, b) => rank(a.s.zone) - rank(b.s.zone) || a.i - b.i)
    .map(({ s }, idx) => ({ ...s, number: String(idx + 1).padStart(2, '0') }));
}

/** "עודכן לאחרונה" — תמיד כולל שעה. אזור זמן ישראל. */
export function formatLastUpdated(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('he-IL', {
    timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('day')}.${get('month')}.${get('year')} ${get('hour')}:${get('minute')}`;
}

/** מקביל ל-state.meta של newState() בישן (השדות הרלוונטיים לדוח עצמו). */
export function emptyMeta(): ReportMeta {
  return {
    reportNumber: '', date: '', issueDate: '', client: '', clientAddress: '', attentionTo: '', siteName: '', address: '',
    project: '', description: '', testInstruments: '', requester: '', testInstrumentsSelected: [], testInstrumentsOther: '',
  };
}

export function emptySettings(formTypeName: string): ReportSettingsSync {
  return {
    formTypeName, cloudReportId: null, cloudKnownUpdatedAt: null, cloudInsertPending: false,
    cloudEditSeq: 0, cloudSyncedSeq: 0, savedByDevice: null, cloudClientId: null, cloudProjectId: null,
  };
}
