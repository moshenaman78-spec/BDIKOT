/**
 * core/reportTypes.ts — מקור אמת יחיד ל-19 סוגי הדוחות.
 *
 * הועתק 1:1 מהאפליקציה הקיימת (v2.2.552, js/app.js):
 *   - REPORT_TYPE_CODE_TO_DISPLAY_NAME  (שורה ~4973)  → code + nameHe
 *   - getReportType()                   (שורה ~4921)  → אותם 19 קודים, ברירת מחדל SMA
 *   - getReportNumberPrefix()                          → numberPrefix
 *   - FORM_TYPE_CATEGORIES              (שורה ~3776)  → categories
 *   - DRAFTS_FOLDER_GROUP_OVERRIDE                     → draftsFolder
 *   - getSharedSectionsNextNumber()                    → sharedSectionsStart
 *
 * הקוד (code) הוא מה שנשמר בעמודת reports.report_type בענן — אסור לשנות קוד קיים,
 * אחרת טיוטות קיימות "ייעלמו" מהתיקיות שלהן.
 */

export const REPORT_TYPE_CODES = [
  'SMA',
  'SOIL',
  'GROUNDING',
  'DC_CABLE',
  'EVCS',
  'EV_DC',
  'GENERAL',
  'MEDICAL',
  'LIGHTNING',
  'TOUCH_VOLTAGE',
  'TRANSFORMER_WINDING',
  'HV_CABLE',
  'FLEXIBLE',
  'MAIN_PANEL',
  'TRANSFORMER_INSPECTION',
  'GENERATOR',
  'STRING_POLARITY',
  'PV_INSPECTION',
  'FIRE_FORM3',
] as const;

export type ReportTypeCode = (typeof REPORT_TYPE_CODES)[number];

/** קטגוריות בורר "בחר סוג טופס בדיקה" — סדר ושמות כמו באפליקציה הקיימת. */
export const REPORT_CATEGORIES = [
  'תחזוקה וממירים',
  'בדיקות אדמה והארקה',
  'בדיקות כבלים וגידים',
  'עמדות טעינה',
  'בדיקות מתקני חשמל',
  'בדיקות מיוחדות',
  'בדיקות סולאריות',
  'דוחות כיבוי אש',
  'בדיקות בידוד / מג',
  'בדיקות מתח גבוה',
] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

/** איזה כיתוב/פורמט PDF: מסמך החברה (לוגו + כותרת עמוד) או טופס רשמי עצמאי (טופס 3). */
export type DocumentKind = 'company-letterhead' | 'official-form';

export interface ReportTypeDefinition {
  code: ReportTypeCode;
  /** שם התצוגה המדויק בעברית — זהה ל-formTypeName באפליקציה הקיימת. */
  nameHe: string;
  /** קידומת מספר הדוח: PREFIX-מונה-חודש-שנה, למשל HV-1064-08-2026. */
  numberPrefix: string;
  /** קטגוריות בבורר (סוג יכול להופיע ביותר מאחת). ריק = לא מוצג בבורר (EV_DC). */
  categories: readonly ReportCategory[];
  /** תיקיית טיוטות משותפת (חד-ערכית). undefined = תיקייה לפי הקוד. */
  draftsFolder?: string;
  /** מספר הסעיף הראשון של הסעיפים המשותפים (הצהרות/אישור) — undefined = לא רלוונטי. */
  sharedSectionsStart?: number;
  /** אייקון לכרטיס/לשונית בעיצוב החדש. */
  icon: string;
  documentKind: DocumentKind;
  /** פונקציות הרינדור באפליקציה הישנה — הפניה למיגרציה (docs/MIGRATION.md). */
  legacy: { renderFn: string; factoryFns: readonly string[] };
}

export const DEFAULT_REPORT_TYPE: ReportTypeCode = 'SMA';

export const REPORT_TYPES: Readonly<Record<ReportTypeCode, ReportTypeDefinition>> = {
  SMA: {
    // האפליקציה החדשה: דוח תחזוקה (תחנות TR, לוח, תאי מ"ג, שנאי, ניקיון ממיר, בידוד).
    // legacy מתעד את הרינדור הישן של לוחות DC — לא את מבנה דוח התחזוקה.
    code: 'SMA', nameHe: 'טיפול בממירי SMA', numberPrefix: 'SMA',
    categories: ['תחזוקה וממירים'], sharedSectionsStart: 7, icon: '🔌', documentKind: 'company-letterhead',
    legacy: { renderFn: '(ברירת המחדל של render — panels/panelOrder)', factoryFns: ['makePanel', 'makeItemPair', 'makeDccbItem', 'makeDpsItem'] },
  },
  SOIL: {
    code: 'SOIL', nameHe: 'בדיקת התנגדות סגולית של הקרקע', numberPrefix: 'GEO',
    categories: ['בדיקות אדמה והארקה'], icon: '🌍', documentKind: 'company-letterhead',
    legacy: { renderFn: 'renderSoilTestCards', factoryFns: [] },
  },
  GROUNDING: {
    code: 'GROUNDING', nameHe: 'בדיקת התנגדות אלקטרודת הארקה למסה הכללית של האדמה', numberPrefix: 'RPT',
    categories: ['בדיקות אדמה והארקה'], sharedSectionsStart: 7, icon: '⏚', documentKind: 'company-letterhead',
    legacy: { renderFn: 'renderGroundingTestCards', factoryFns: ['makeGroundingClampTest', 'makeGroundingSelectiveTest'] },
  },
  DC_CABLE: {
    code: 'DC_CABLE', nameHe: 'בדיקת בידוד וקוטביות כבלי וגידי DC', numberPrefix: 'RPT',
    categories: ['בדיקות כבלים וגידים', 'בדיקות בידוד / מג'], icon: '〰️', documentKind: 'company-letterhead',
    legacy: { renderFn: 'renderDcCableTestCards', factoryFns: ['makeDcCableGroup', 'makeDcCableRow'] },
  },
  EVCS: {
    code: 'EVCS', nameHe: 'בדיקת עמדת טעינה', numberPrefix: 'RPT',
    categories: ['עמדות טעינה'], sharedSectionsStart: 4, icon: '🚗', documentKind: 'company-letterhead',
    legacy: { renderFn: 'renderEvcsReportCards', factoryFns: ['makeEvcsStation', 'makeInstallationSupply'] },
  },
  EV_DC: {
    // קיים כקוד ושם, אך לא מופיע ב-FORM_TYPE_OPTIONS/FORM_TYPE_CATEGORIES באפליקציה הקיימת
    // (נפתח מתוך עמדת טעינה). נשמר כאן כדי שטיוטות EV_DC קיימות ימשיכו להיטען.
    code: 'EV_DC', nameHe: 'בדיקת עמדת טעינה DC', numberPrefix: 'RPT',
    categories: [], icon: '⚡', documentKind: 'company-letterhead',
    legacy: { renderFn: 'renderEvDcTestCards', factoryFns: ['makeEvDcVisualItem', 'makeEvDcRisoRow', 'makeEvDcLoopRow', 'makeEvDcBreakerRow', 'makeEvDcCableRow'] },
  },
  GENERAL: {
    code: 'GENERAL', nameHe: 'דוח כללי לבדיקת מתקן חשמל', numberPrefix: 'RPT',
    categories: ['בדיקות מתקני חשמל'], sharedSectionsStart: 15, icon: '🏢', documentKind: 'company-letterhead',
    legacy: { renderFn: 'renderGeneralInspectionCards', factoryFns: ['makeGeneralSupply', 'makeGeneralInspectionSection', 'makeGeneralBoardCircuitRow'] },
  },
  MEDICAL: {
    code: 'MEDICAL', nameHe: 'דוח בדיקה למתקן רפואי — קבוצת שימוש 2', numberPrefix: 'RPT',
    categories: ['בדיקות מתקני חשמל'], icon: '🏥', documentKind: 'company-letterhead',
    legacy: { renderFn: 'renderMedicalReportCards', factoryFns: ['makeMedicalChecklistItem', 'makeMedicalMonitorMeasurement', 'makeAntiStaticFloorPoint'] },
  },
  LIGHTNING: {
    code: 'LIGHTNING', nameHe: 'דוח בדיקת מערכת הגנה מפני ברקים', numberPrefix: 'RPT',
    categories: ['בדיקות מיוחדות'], sharedSectionsStart: 4, icon: '🌩️', documentKind: 'company-letterhead',
    legacy: { renderFn: 'renderLightningReportCards', factoryFns: ['makeContinuityItem'] },
  },
  TOUCH_VOLTAGE: {
    code: 'TOUCH_VOLTAGE', nameHe: 'דוח בדיקת מתח מגע', numberPrefix: 'RPT',
    categories: ['בדיקות מיוחדות'], sharedSectionsStart: 6, icon: '✋', documentKind: 'company-letterhead',
    legacy: { renderFn: 'renderTouchVoltageReportCards', factoryFns: ['makeTouchStepItem'] },
  },
  TRANSFORMER_WINDING: {
    code: 'TRANSFORMER_WINDING', nameHe: 'דוח בדיקת התנגדות סלילים בשטח', numberPrefix: 'RPT',
    categories: ['בדיקות סולאריות'], sharedSectionsStart: 9, icon: '🌀', documentKind: 'company-letterhead',
    legacy: { renderFn: 'renderTransformerWindingReportCards', factoryFns: ['makeWindingTapRow'] },
  },
  HV_CABLE: {
    // דוח VLF לכבלי מתח גבוה
    code: 'HV_CABLE', nameHe: 'דוח בדיקת כבל מתח גבוה', numberPrefix: 'RPT',
    categories: ['בדיקות כבלים וגידים', 'בדיקות מתח גבוה'], sharedSectionsStart: 7, icon: '🧵', documentKind: 'company-letterhead',
    legacy: { renderFn: 'renderHvCableReportCards', factoryFns: ['makeHvCableRow', 'makeHvCableEquipmentRow'] },
  },
  FLEXIBLE: {
    code: 'FLEXIBLE', nameHe: 'דוח גמיש', numberPrefix: 'RPT',
    categories: [], icon: '🧩', documentKind: 'company-letterhead',
    legacy: { renderFn: 'renderFlexibleReportCards', factoryFns: ['makeFlexibleSection', 'makeFlexibleTableSection', 'makeFlexibleFinding', 'makeFlexPanelChecklist'] },
  },
  MAIN_PANEL: {
    // משמש גם ללוחות מתח גבוה (קידומת HV)
    code: 'MAIN_PANEL', nameHe: 'דוח בדיקת לוח חשמל ראשי', numberPrefix: 'HV',
    categories: ['בדיקות מתקני חשמל', 'בדיקות מתח גבוה'], draftsFolder: 'בדיקות מתח גבוה', sharedSectionsStart: 4,
    icon: '🗄️', documentKind: 'company-letterhead',
    legacy: { renderFn: 'renderMainPanelReportCards', factoryFns: ['makeMainPanelFacility', 'makeMainPanelBreaker', 'makeMainPanelCell', 'makeMainPanelLoopTest'] },
  },
  TRANSFORMER_INSPECTION: {
    code: 'TRANSFORMER_INSPECTION', nameHe: 'דוח בדיקת שנאי מתח גבוה', numberPrefix: 'TR',
    categories: ['בדיקות מתח גבוה'], draftsFolder: 'בדיקות מתח גבוה', sharedSectionsStart: 5,
    icon: '🔋', documentKind: 'company-letterhead',
    legacy: { renderFn: 'renderTransformerInspectionReportCards', factoryFns: ['makeTransformerInspectionItem', 'makeTransformerInspectionGroundingBlock'] },
  },
  GENERATOR: {
    code: 'GENERATOR', nameHe: 'דוח בדיקת גנרטור', numberPrefix: 'RPT',
    categories: ['בדיקות מתקני חשמל'], sharedSectionsStart: 10, icon: '⚙️', documentKind: 'company-letterhead',
    legacy: { renderFn: 'renderGeneratorReportCards', factoryFns: ['makeGeneratorItem', 'makeGeneratorProtectionsBlock'] },
  },
  STRING_POLARITY: {
    code: 'STRING_POLARITY', nameHe: 'בדיקת קוטביות סטרינגים ולוחות DCCB', numberPrefix: 'PV',
    categories: ['בדיקות סולאריות'], sharedSectionsStart: 5, icon: '🔀', documentKind: 'company-letterhead',
    legacy: { renderFn: 'renderStringPolarityReportCards', factoryFns: ['makeStringPolarityReport', 'makeStringPolarityInverter', 'makeStringPolarityCircuit', 'makeStringPolarityDccbPanel'] },
  },
  PV_INSPECTION: {
    code: 'PV_INSPECTION', nameHe: 'טופס בדיקה של מתקן פוטו-וולטאי', numberPrefix: 'PV',
    categories: ['בדיקות סולאריות'], icon: '☀️', documentKind: 'company-letterhead',
    legacy: { renderFn: 'renderPvInspectionCards', factoryFns: ['makePvInspection', 'makePvParty', 'makePvRcd', 'makePvItMonitor'] },
  },
  FIRE_FORM3: {
    // טופס רשמי של כבאות והצלה — PDF עצמאי בלי הלוגו/הפוטר של החברה
    code: 'FIRE_FORM3', nameHe: 'טופס 3 - אישור תקינות מערכת חשמל ותאורת חירום', numberPrefix: 'F3',
    categories: ['דוחות כיבוי אש'], icon: '🧯', documentKind: 'official-form',
    legacy: { renderFn: '(renderFireForm3*)', factoryFns: ['makeFireForm3', 'makeF3Panel'] },
  },
};

/** סדר הרשימה בבורר — זהה ל-FORM_TYPE_OPTIONS באפליקציה הקיימת (EV_DC לא מוצג שם). */
export const PICKER_ORDER: readonly ReportTypeCode[] = [
  'SMA', 'SOIL', 'GROUNDING', 'DC_CABLE', 'EVCS', 'GENERAL', 'MEDICAL', 'LIGHTNING', 'TOUCH_VOLTAGE',
  'TRANSFORMER_WINDING', 'HV_CABLE', 'FLEXIBLE', 'MAIN_PANEL', 'TRANSFORMER_INSPECTION', 'GENERATOR',
  'STRING_POLARITY', 'PV_INSPECTION', 'FIRE_FORM3',
];

export function isReportTypeCode(v: unknown): v is ReportTypeCode {
  return typeof v === 'string' && (REPORT_TYPE_CODES as readonly string[]).includes(v);
}

export function getReportType(code: ReportTypeCode): ReportTypeDefinition {
  return REPORT_TYPES[code];
}

/** קוד → שם תצוגה; קוד לא מוכר מוחזר כמו שהוא (כמו reportTypeCodeToDisplayName הישנה). */
export function reportTypeDisplayName(code: string): string {
  return isReportTypeCode(code) ? REPORT_TYPES[code].nameHe : code;
}

/** שם עברי (formTypeName הישן) → קוד. לא מוכר → SMA, בדיוק כמו getReportType() הישנה. */
export function reportTypeFromHebrewName(nameHe: string | null | undefined): ReportTypeCode {
  const hit = REPORT_TYPE_CODES.find((c) => REPORT_TYPES[c].nameHe === nameHe);
  return hit ?? DEFAULT_REPORT_TYPE;
}

/** כותרת דינמית: בדוח SMA שם יצרן הממיר נכנס לכותרת (getDynamicReportTypeTitle). */
export function dynamicReportTitle(code: ReportTypeCode, inverterBrand?: string): string {
  if (code === 'SMA') return `טיפול בממירי ${(inverterBrand ?? '').trim() || 'SMA'}`;
  return REPORT_TYPES[code].nameHe;
}

export const COMBINED_DRAFTS_FOLDER = '📚 דוחות משולבים (כמה טפסים)';

/** מפתח תיקיית טיוטות — דוח משולב (עם פרקים) תמיד בתיקייה נפרדת. */
export function draftsFolderKey(code: string, chapterCount = 0): string {
  if (chapterCount > 0) return COMBINED_DRAFTS_FOLDER;
  if (!isReportTypeCode(code)) return 'UNKNOWN';
  return REPORT_TYPES[code].draftsFolder ?? code;
}

export function draftsFolderDisplayName(key: string): string {
  if (key === COMBINED_DRAFTS_FOLDER) return key;
  if (REPORT_TYPE_CODES.some((c) => REPORT_TYPES[c].draftsFolder === key)) return key;
  return reportTypeDisplayName(key);
}

export function typesInCategory(cat: ReportCategory): ReportTypeCode[] {
  return PICKER_ORDER.filter((c) => REPORT_TYPES[c].categories.includes(cat));
}
