/**
 * services/reports/ReportTypeService.ts — החוזה שכל שירות סוג-דוח מממש.
 *
 * שירות סוג-דוח אחראי רק על:
 *   1. createEmpty()   — מבנה ריק לדוח חדש (זהה לפונקציית ה-make* בישן)
 *   2. normalize()     — השלמת ברירות מחדל לנתונים שנטענו (כמו deepMergeGeneric בישן),
 *                        בלי למחוק שדות לא מוכרים
 *   3. validate()      — בעיות לפני הפקה
 *   4. buildSections() — סעיפי התוכן (content) ואופציונלית סעיפי סיכום (summary)
 *   5. findings()      — ליקויים (לטבלת "ריכוז ליקויים" / העתקה לממצאים)
 *
 * legacyKey: המפתח ב-report_data שבו האפליקציה הישנה שומרת את הנתונים של הסוג
 * (למשל 'transformerInspectionReport'). שירות עם legacyKey קורא וכותב *רק* לשם — כך דוח
 * שנערך באפליקציה החדשה נפתח בישנה בלי שום המרה. בלי legacyKey — typeData (מעבר בלבד).
 *
 * buildReportDocument מוסיף את הסעיפים המשותפים ואוכף את הסדר:
 *   פרטי המתקן → תוכן (לוחות + כל הטקסט) → סיכום → הערות → הצהרה → חתימה.
 */
import type { Block, DocumentSection, ReportData, ReportDocument } from '@/core/reportModel';
import { FIXED_DECLARATIONS, formatLastUpdated, orderSections } from '@/core/reportModel';
import { dynamicReportTitle, getReportType, type ReportTypeCode, type ReportTypeDefinition } from '@/core/reportTypes';
import { relayFindings, relaysApply, relaysSection } from '@/services/shared/protectionRelays';

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
  /** המפתח ב-report_data של האפליקציה הישנה. undefined = typeData (שלד). */
  readonly legacyKey?: string;
  /** להציג טבלת "ריכוז ליקויים" אוטומטית בסיכום. false כשהסוג מנהל ממצאים בעצמו. */
  readonly showFindingsTable: boolean;
  /** true = השירות עדיין שלד; ה-UI מציג "בבנייה — ערוך באפליקציה הקיימת". */
  readonly isSkeleton: boolean;
  createEmpty(): T;
  normalize(raw: unknown): T;
  validate(typeData: T, data: ReportData): ValidationIssue[];
  buildSections(typeData: T, data: ReportData): DocumentSection[];
  findings(typeData: T): Finding[];
}

type Impl<T extends object> = Partial<Omit<ReportTypeService<T>, 'code' | 'definition'>> & Pick<ReportTypeService<T>, 'createEmpty'>;

/** עוזר: יוצר שירות עם ברירות מחדל סבירות (normalize = מיזוג עם createEmpty). */
export function defineReportService<T extends object>(code: ReportTypeCode, impl: Impl<T>): ReportTypeService<T> {
  return {
    code,
    definition: getReportType(code),
    legacyKey: impl.legacyKey,
    showFindingsTable: impl.showFindingsTable ?? true,
    isSkeleton: impl.isSkeleton ?? false,
    createEmpty: impl.createEmpty,
    normalize: impl.normalize ?? ((raw) => mergeDefaults(impl.createEmpty(), raw)),
    validate: impl.validate ?? (() => []),
    buildSections: impl.buildSections ?? (() => []),
    findings: impl.findings ?? (() => []),
  };
}

/** קורא את נתוני הסוג מהמקום הנכון (המפתח הישן, או typeData) ומנרמל. */
export function readTypeData<T extends object>(service: ReportTypeService<T>, data: ReportData): T {
  const raw = service.legacyKey ? data[service.legacyKey] : data.typeData;
  return service.normalize(raw);
}

/** כותב את נתוני הסוג למקום הנכון. לא נוגע בשום מפתח אחר. */
export function writeTypeData<T extends object>(service: ReportTypeService<T>, data: ReportData, typeData: T): void {
  if (service.legacyKey) data[service.legacyKey] = typeData;
  else data.typeData = typeData as Record<string, unknown>;
}

/**
 * מיזוג: שדות חסרים מקבלים ברירת מחדל, שדות קיימים (גם לא מוכרים) נשמרים.
 * אובייקטים מקוננים (לא מערכים) ממוזגים רקורסיבית — כמו deepMergeGeneric בישן, אבל בלי לזרוק
 * מפתחות שלא מופיעים בברירת המחדל.
 */
export function mergeDefaults<T extends object>(defaults: T, raw: unknown): T {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return defaults;
  const out: Record<string, unknown> = { ...(raw as Record<string, unknown>) };
  for (const [k, v] of Object.entries(defaults)) {
    const cur = out[k];
    if (cur === undefined || cur === null) out[k] = v;
    else if (Array.isArray(v)) { if (!Array.isArray(cur)) out[k] = v; }
    else if (typeof v === 'object' && v !== null) out[k] = typeof cur === 'object' && !Array.isArray(cur) ? mergeDefaults(v, cur) : v;
  }
  return out as T;
}

/* ---------------------- סעיפים משותפים ---------------------- */

function facilitySection(data: ReportData): DocumentSection {
  const m = data.meta;
  // מספר הדוח לא מופיע כאן — הוא מוצג פעם אחת בלבד, בכותרת העמוד.
  const instruments = Array.isArray(m.testInstrumentsSelected) ? (m.testInstrumentsSelected as string[]).join(', ') : '';
  const rows = [
    { label: 'מזמין הבדיקה', value: m.client },
    { label: 'לידי (איש קשר)', value: String(m.attentionTo ?? '') },
    { label: 'שם המתקן', value: m.siteName },
    { label: 'מיקום המתקן', value: m.address },
    { label: 'פרויקט', value: m.project },
    { label: 'תאריך הבדיקה', value: m.date },
    { label: 'תאריך הפקת הדוח', value: String(m.issueDate ?? '') },
    { label: 'תיאור המתקן/העבודה', value: m.description },
    { label: 'מכשירי בדיקה', value: [instruments, String(m.testInstrumentsOther ?? '')].filter(Boolean).join(', ') },
  ].filter((r) => r.value);
  return { id: 'facility', zone: 'facility', title: 'פרטי המתקן', icon: '🏭', blocks: [{ kind: 'fields', rows }] };
}

function findingsSection(findings: Finding[]): DocumentSection | null {
  if (!findings.length) return null;
  const block: Block = { kind: 'table', caption: 'ריכוז ליקויים', columns: ['מיקום', 'ליקוי'], rows: findings.map((f) => [f.where, f.text]) };
  return { id: 'findings', zone: 'summary', title: 'סיכום ליקויים', icon: '📋', blocks: [block] };
}

function notesSection(data: ReportData): DocumentSection | null {
  const items = (Array.isArray(data.notes) ? data.notes : []).map((n) => String(n ?? '').trim()).filter(Boolean);
  return items.length ? { id: 'notes', zone: 'notes', title: 'הערות', icon: '📝', blocks: [{ kind: 'notes', items }] } : null;
}

/** 5 ההצהרות הקבועות תמיד + הצהרה נוספת אם קיימת — כמו בישן. */
function declarationSection(data: ReportData): DocumentSection {
  const custom = String(data.customDeclaration ?? '').trim();
  return {
    id: 'declaration', zone: 'declaration', title: 'הערות בודק', icon: '✍️',
    blocks: [{ kind: 'notes', items: [...FIXED_DECLARATIONS, ...(custom ? [custom] : [])] }],
  };
}

/** בונה את מודל המסמך המלא לתצוגה/הדפסה. */
export function buildReportDocument<T extends object>(
  service: ReportTypeService<T>,
  data: ReportData,
  lastUpdatedAt: string | null,
): ReportDocument {
  const typeData = readTypeData(service, data);
  const def = service.definition;
  const isOfficial = def.documentKind === 'official-form';
  // שירות רשאי להחזיר content או summary. כל אזור אחר מוחזר ל-content — הערות/הצהרה/חתימה תמיד בסוף.
  const own = service.buildSections(typeData, data).map((s) =>
    s.zone === 'content' || s.zone === 'summary' ? s : { ...s, zone: 'content' as const },
  );
  // מודולים משותפים (תוכן — תמיד לפני הסיכום)
  const shared = relaysApply(def.code) ? [relaysSection(data)].filter((s): s is DocumentSection => !!s) : [];
  const findings = [...service.findings(typeData), ...(relaysApply(def.code) ? relayFindings(data) : [])];
  const sections: DocumentSection[] = isOfficial
    ? own // טופס רשמי: המבנה כולו מוגדר בשירות, בלי סעיפי החברה
    : [
        facilitySection(data),
        ...own,
        ...shared,
        ...[service.showFindingsTable ? findingsSection(findings) : null, notesSection(data)]
          .filter((s): s is DocumentSection => !!s),
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
