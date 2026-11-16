/**
 * services/reports/ReportTypeService.ts — החוזה שכל שירות סוג-דוח מממש.
 *
 * שירות סוג-דוח אחראי רק על:
 *   1. createEmpty()  — מבנה typeData ריק לדוח חדש
 *   2. normalize()    — השלמת ברירות מחדל לנתונים שנטענו (כמו getFireForm3 בישן)
 *   3. validate()     — בעיות לפני הפקה (שדות חובה, ערכים חריגים)
 *   4. buildSections() — סעיפי התוכן (facility/content) למסמך
 *   5. findings()     — ליקויים לסיכום
 * הכותרת, הסיכום, ההערות, ההצהרה והחתימה משותפים — buildReportDocument מוסיף אותם
 * ומבטיח את הסדר: לוחות וטקסט → סיכום → הערות → הצהרה → חתימה.
 */
import type { Block, DocumentSection, ReportData, ReportDocument } from '@/core/reportModel';
import { formatLastUpdated, orderSections } from '@/core/reportModel';
import { dynamicReportTitle, getReportType, type ReportTypeCode, type ReportTypeDefinition } from '@/core/reportTypes';

export interface ValidationIssue {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface Finding {
  where: string;
  text: string;
}

export interface ReportTypeService<T extends object = Record<string, unknown>> {
  readonly code: ReportTypeCode;
  readonly definition: ReportTypeDefinition;
  createEmpty(): T;
  normalize(raw: unknown): T;
  validate(typeData: T, data: ReportData): ValidationIssue[];
  buildSections(typeData: T, data: ReportData): DocumentSection[];
  findings(typeData: T): Finding[];
  /** true = השירות עדיין שלד; ה-UI מציג "בבנייה — ערוך באפליקציה הקיימת". */
  readonly isSkeleton: boolean;
}

/** עוזר: יוצר שירות עם ברירות מחדל סבירות (normalize = מיזוג עם createEmpty). */
export function defineReportService<T extends object>(
  code: ReportTypeCode,
  impl: Partial<Omit<ReportTypeService<T>, 'code' | 'definition'>> & Pick<ReportTypeService<T>, 'createEmpty'>,
): ReportTypeService<T> {
  const definition = getReportType(code);
  return {
    code,
    definition,
    isSkeleton: impl.isSkeleton ?? false,
    createEmpty: impl.createEmpty,
    normalize: impl.normalize ?? ((raw) => mergeDefaults(impl.createEmpty(), raw)),
    validate: impl.validate ?? (() => []),
    buildSections: impl.buildSections ?? (() => []),
    findings: impl.findings ?? (() => []),
  };
}

/** מיזוג רדוד+מערכים: שדות חסרים מקבלים ברירת מחדל, שדות קיימים (גם לא מוכרים) נשמרים. */
export function mergeDefaults<T extends object>(defaults: T, raw: unknown): T {
  if (typeof raw !== 'object' || raw === null) return defaults;
  const out: Record<string, unknown> = { ...(raw as Record<string, unknown>) };
  for (const [k, v] of Object.entries(defaults)) {
    if (out[k] === undefined || out[k] === null) out[k] = v;
    else if (Array.isArray(v) && !Array.isArray(out[k])) out[k] = v;
  }
  return out as T;
}

/* ---------------------- סעיפים משותפים ---------------------- */

const DEFAULT_DECLARATION =
  'אני החתום מטה מצהיר כי ביצעתי את הבדיקות המפורטות בדוח זה בהתאם לחוק החשמל ותקנותיו, וכי הממצאים משקפים את מצב המתקן במועד הבדיקה.';

function facilitySection(data: ReportData): DocumentSection {
  const m = data.meta;
  // מספר הדוח לא מופיע כאן — הוא מוצג פעם אחת בלבד, בכותרת העמוד.
  const rows = [
    { label: 'לקוח', value: m.client },
    { label: 'שם האתר', value: m.siteName },
    { label: 'כתובת', value: m.address },
    { label: 'פרויקט', value: m.project },
    { label: 'תאריך בדיקה', value: m.date },
    { label: 'תיאור', value: m.description },
  ].filter((r) => r.value);
  return { id: 'facility', zone: 'facility', title: 'פרטי המתקן', icon: '🏭', blocks: [{ kind: 'fields', rows }] };
}

function summarySection(data: ReportData, findings: Finding[]): DocumentSection | null {
  const blocks: Block[] = [];
  if (findings.length) {
    blocks.push({ kind: 'table', caption: 'ריכוז ליקויים', columns: ['מיקום', 'ליקוי'], rows: findings.map((f) => [f.where, f.text]) });
  }
  if (data.summary.trim()) blocks.push({ kind: 'paragraph', text: data.summary.trim() });
  return blocks.length ? { id: 'summary', zone: 'summary', title: 'סיכום', icon: '📋', blocks } : null;
}

function notesSection(data: ReportData): DocumentSection | null {
  const items = data.notes.map((n) => n.text.trim()).filter(Boolean);
  return items.length ? { id: 'notes', zone: 'notes', title: 'הערות', icon: '📝', blocks: [{ kind: 'notes', items }] } : null;
}

function declarationSection(data: ReportData): DocumentSection {
  const text = (data.settings.declarationText as string | undefined)?.trim() || DEFAULT_DECLARATION;
  return { id: 'declaration', zone: 'declaration', title: 'הצהרה', icon: '✍️', blocks: [{ kind: 'paragraph', text }] };
}

/** בונה את מודל המסמך המלא לתצוגה/הדפסה. */
export function buildReportDocument<T extends object>(
  service: ReportTypeService<T>,
  data: ReportData,
  lastUpdatedAt: string | null,
): ReportDocument {
  const typeData = service.normalize(data.typeData);
  const def = service.definition;
  const isOfficial = def.documentKind === 'official-form';
  const content = service.buildSections(typeData, data).map((s) =>
    // שירות שמחזיר אזור לא-תוכן (summary/notes/...) מוחזר ל-content — הסדר נאכף כאן
    s.zone === 'facility' || s.zone === 'content' ? s : { ...s, zone: 'content' as const },
  );
  const findings = service.findings(typeData);
  const sections: DocumentSection[] = isOfficial
    ? content // טופס רשמי: המבנה כולו מוגדר בשירות, בלי סעיפי החברה
    : [
        facilitySection(data),
        ...content,
        ...[summarySection(data, findings), notesSection(data)].filter((s): s is DocumentSection => !!s),
        declarationSection(data),
        { id: 'signature', zone: 'signature', title: 'חתימה', icon: '🖊️', blocks: [] },
      ];
  return {
    typeCode: def.code,
    title: dynamicReportTitle(def.code, data.settings.inverterBrand as string | undefined),
    reportNumber: data.meta.reportNumber,
    inspectionDate: data.meta.date,
    lastUpdatedAt,
    documentKind: def.documentKind,
    sections: orderSections(sections),
  };
}

export { formatLastUpdated };
