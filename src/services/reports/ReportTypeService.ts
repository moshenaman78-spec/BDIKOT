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
import type { Block, CoverPage, DocumentSection, ReportData, ReportDocument } from '@/core/reportModel';
import { FIXED_DECLARATIONS, formatLastUpdated, orderSections } from '@/core/reportModel';
import { dynamicReportTitle, getReportType, type ReportTypeCode, type ReportTypeDefinition } from '@/core/reportTypes';
import { EMPTY_PROFILE, type CompanyProfile } from '@/services/companySettingsService';
import { approvalApplies, approvalSection } from '@/services/shared/approval';
import { DEFECT_REPAIR_TYPES, defectRepairSection } from '@/services/shared/defectRepair';
import { electricianBlock } from '@/services/shared/electricianDeclaration';
import { photosSection } from '@/services/shared/photos';
import { relayFindings, relaysApply, relaysSection } from '@/services/shared/protectionRelays';
import { formatDateIL, instrumentsCoverText, type Equipment } from '@/services/shared/testInstruments';

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
  /** יש בדוח ליקוי (מפעיל הצהרת חשמלאי לתיקון ליקוי בסוגים שתומכים בה). ברירת מחדל: יש findings. */
  hasDefect(typeData: T, data: ReportData): boolean;
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
    hasDefect: impl.hasDefect ?? ((t) => (impl.findings ? impl.findings(t).length > 0 : false)),
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

export interface DocumentOptions {
  /** הגדרות חברה (מהענן, עם נפילה להגדרות שבדוח). בלי — עמוד שער בלי פרטי בודק. */
  company?: CompanyProfile;
  /** רשימת מכשירי הבדיקה מהענן — לדגם/מס' סידורי/תוקף כיול בעמוד השער. */
  equipment?: Equipment[];
  /** "היום" — לתאריך הפקה כשלא נקבע (ולבדיקות). */
  today?: Date;
}

/** עמוד השער — אותן שורות ואותו סדר כמו buildCoverPage בישן; שורה ריקה לא מוצגת. */
export function buildCover(title: string, data: ReportData, opts: DocumentOptions): CoverPage {
  const m = data.meta;
  const c = opts.company ?? EMPTY_PROFILE;
  const today = opts.today ?? new Date();
  const todayIL = `${today.getDate()}.${today.getMonth() + 1}.${today.getFullYear()}`;
  const rows: Array<[string, string]> = [
    ['מזמין הבדיקה', m.client],
    ['לידי (איש קשר)', String(m.attentionTo ?? '')],
    ['שם המתקן', m.siteName],
    ['מיקום המתקן', m.address],
    ['תאריך הבדיקה', formatDateIL(m.date)],
    ['תאריך הפקת הדוח', m.issueDate ? formatDateIL(String(m.issueDate)) : todayIL],
    ['מבצע הבדיקה', [c.engineerName, c.licenseType].filter(Boolean).join(' — ')],
    ['מספר רישיון בודק', c.testerLicenseNo],
    ['מספר רישיון מהנדס', c.engineerLicenseNo],
    ['תיאור המתקן/העבודה', m.description],
    ['מכשירי בדיקה', instrumentsCoverText(data, opts.equipment ?? [])],
  ];
  const el = electricianBlock(data, c.hideElectricianDeclaration);
  return {
    title,
    reportNumber: m.reportNumber,
    rows: rows.filter(([, v]) => v).map(([label, value]) => ({ label, value })),
    electrician: el ? { text: el.text, name: el.name, licenseType: el.licenseType, licenseNo: el.licenseNo, date: formatDateIL(el.date) } : null,
    inspectorName: c.engineerName,
  };
}

function footerText(c: CompanyProfile | undefined): string {
  if (!c) return '';
  return [c.companyName, c.engineerName, c.phone, c.officePhone, c.email, c.companyAddress].filter(Boolean).join(' • ');
}

function licenseSection(c: CompanyProfile | undefined): DocumentSection | null {
  if (!c?.attachLicenseToReports) return null;
  const caption = [c.engineerName, c.engineerLicenseNo && `רישיון מס' ${c.engineerLicenseNo}`].filter(Boolean).join(' · ');
  return { id: 'inspector-license', zone: 'appendix', title: 'צילום רישיון בודק', icon: '🪪', pageBreakBefore: true, blocks: [{ kind: 'image', imageKey: 'inspectorLicense', caption }] };
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
  opts: DocumentOptions = {},
): ReportDocument {
  const typeData = readTypeData(service, data);
  const def = service.definition;
  const isOfficial = def.documentKind === 'official-form';
  const title = dynamicReportTitle(def.code, data.settings.inverterBrand as string | undefined);
  // שירות רשאי להחזיר content או summary. כל אזור אחר מוחזר ל-content — הערות/הצהרה/חתימה תמיד בסוף.
  const own = service.buildSections(typeData, data).map((s) =>
    s.zone === 'content' || s.zone === 'summary' ? s : { ...s, zone: 'content' as const },
  );
  const present = (xs: Array<DocumentSection | null>) => xs.filter((s): s is DocumentSection => !!s);
  // מודולים משותפים
  const relays = relaysApply(def.code);
  const findings = [...service.findings(typeData), ...(relays ? relayFindings(data) : [])];
  const sections: DocumentSection[] = isOfficial
    ? own // טופס רשמי: המבנה כולו מוגדר בשירות, בלי סעיפי החברה
    : [
        // "פרטי המתקן" מוצגים בעמוד השער (כמו בישן) — לא כסעיף נפרד
        ...own,
        ...present([relays ? relaysSection(data) : null]),
        ...present([
          service.showFindingsTable ? findingsSection(findings) : null,
          approvalApplies(def.code) ? approvalSection(data) : null,
          notesSection(data),
        ]),
        declarationSection(data),
        // הצהרת חשמלאי לתיקון ליקוי — אוטומטית כשיש ליקוי (כמו hasMainPanelDefect בישן)
        ...present([DEFECT_REPAIR_TYPES.includes(def.code) && service.hasDefect(typeData, data) ? defectRepairSection(data) : null]),
        { id: 'signature', zone: 'signature', title: 'חתימה', icon: '🖊️', blocks: [] },
        ...present([photosSection(data), licenseSection(opts.company)]),
      ];
  return {
    typeCode: def.code,
    title,
    reportNumber: data.meta.reportNumber,
    inspectionDate: data.meta.date,
    lastUpdatedAt,
    documentKind: def.documentKind,
    cover: isOfficial ? null : buildCover(title, data, opts),
    footerText: isOfficial ? '' : footerText(opts.company),
    sections: orderSections(sections),
  };
}

export { formatLastUpdated };
