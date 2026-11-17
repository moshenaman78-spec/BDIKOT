/**
 * MAIN_PANEL — דוח בדיקת לוח חשמל ראשי (משמש גם ללוחות מתח גבוה; קידומת HV; תיקיית "בדיקות מתח גבוה").
 *
 * הועבר מהאפליקציה הישנה (v2.2.552). נשמר באותו מפתח ובאותו מבנה: report_data.mainPanelReport.
 * מה שהישנה עורכת ומדפיסה בפועל (renderMainPanelReportCards / buildMainPanelReportBlocks):
 *   - מסדר מתח גבוה: פרטי מסדר + 3 משני זרם (מדידה/הגנה/מסכם), בדיקה ויזואלית (34 פריטים,
 *     מפה אינדקס→ok/bad/na), פרטי תאים וציוד, הערות
 *   - תאי מתח גבוה (makeHvCell) — כמה שצריך, שכפול/מחיקה
 *   - בדיקות בידוד (DAR / PI / ערך בודד) — services/shared/insulation
 *   - ממצאים מסכמים
 * בנוסף משותף: ממסרי הגנה, תמונות, אישור חשמול, הצהרת חשמלאי מבצע, ו"הצהרת חשמלאי לתיקון ליקוי"
 * שמופיעה אוטומטית כשיש ליקוי (hasMainPanelDefect).
 *
 * facilities[] (לוחות עם ספקי כוח/מפסקים/פריטי בדיקה/תאי CT) ו-mainSwitchgear.panelRows קיימים
 * במבנה הישן אבל לא מוצגים ולא מודפסים שם — נשמרים כאן כמו שהם (וליקוי "X" בהם נספר, כמו בישן).
 * הערות לפריטי הבדיקה הוויזואלית נשמרות ב-state.itemNotes (מפתח הישן) — וכאן גם מודפסות.
 */
import type { Block, DocumentSection, ReportData } from '@/core/reportModel';
import { defineReportService, mergeDefaults, type Finding, type ValidationIssue } from '../ReportTypeService';
import { insulationBlock, insulationFindings, makeInsulationTable, normalizeInsulationTable, rowHasData, type InsulationTable } from '@/services/shared/insulation';
import { APPROVAL_OPTIONS, readApproval } from '@/services/shared/approval';

export const LEGACY_KEY = 'mainPanelReport';
export const ITEM_NOTES_PATH = 'mainPanelReport.mainSwitchgear.checklist';

/* ------------------------------ קבועים (1:1 מהישן) ------------------------------ */

export const MAIN_SWITCHGEAR_CHECKLIST = [
  'בדיקה ויזואלית', 'אטימות של התא', 'בדוק מרחקי בטיחות', 'בדיקת חיזוק הלוח לקרקע', 'שלמות לחצנים נורות והגנות',
  'קורוזיה וחלודה על חלקי הלוח', 'חיזוק ברגים (מד-מומנט)', 'בדיקת חיבור הארקות לפס צבירה', 'בדיקת חיישני טמפרטורה',
  'בדיקת מערכת אוורור החדר', 'בדיקת התנגדות ("מגר" 5KV)', 'בדיקת הארקות', 'סריקה תרמוגרפית',
  'שילוט זיהוי ללוח חשמל כולל הצהרת יצרן להתאמה לתקן', 'התאמת הלוח והתאמים לתכניות', 'התאמת השילוט על גבי הלוח לתכניות',
  'התאמה של מפסקים ומנתקים לתכניות', 'התאמה של מגני נחשולי מתח לתכניות', 'שלמות מחברים ומכודדים', 'קיום ותקינות הארקת הלוח',
  'שלמות אביזרי חיבור', 'קיום מרווחי בטיחות תקינים', 'קיום תרשים חד-קווי עדכני', 'קיום ציוד כיבוי אש מתאים',
  'תקינות לחצן ניתוק בחירום', 'תקינות הארקת השירותים המתכתיים בחדר', 'תקינות תאורה בחדר', 'הימצאות ותקינות תאורת חירום ושלטי יציאה',
  'קיום ותקינות ציוד מיגון אישי (כפפות, מוט, שטיח)', 'קיבוע תקני של הלוח', 'תקינות דלתות ומנעולים', 'זיהוי בהתאם לשילוט וליעוד',
  'זיהוי ובדיקת הצלבות', 'ניקיון הלוח וחדר החשמל', 'בדיקת DGPT',
] as const;

/** סטטוסים בבדיקה הוויזואלית של המסדר (statusGroup בישן). */
export const SWITCHGEAR_STATUS = [
  { value: 'ok', label: 'תקין', tone: 'ok' as const },
  { value: 'bad', label: 'לא תקין', tone: 'bad' as const },
  { value: 'na', label: 'לא רלוונטי', tone: 'na' as const },
];
export const SWITCHGEAR_STATUS_LABEL: Record<string, string> = { ok: 'תקין', bad: 'לא תקין', na: 'לא רלוונטי' };

export const MP_OPTIONS = {
  switchgearManufacturer: ['EATON', 'ABB', 'Schneider Electric', 'Siemens', 'Ormazabal', 'Lucy Electric', 'AFCON'],
  insulationType: ['אוויר (AIS)', 'SF6 (GIS)', 'ואקום', 'מבודד מוצק'],
  cellType: ['תא כניסה', 'תא יציאה', 'תא שנאי', 'תא מדידה', 'תא מקשר', 'תא קבל', 'תא הארקה', 'תא מפסק', 'תא מנתק', 'תא GIS', 'תא AIS', 'תא RMU', 'תא הגנות', 'תא שירות עצמי', 'אחר'],
  breakerType: ['ואקום (Vacuum)', 'SF6', 'שמן (Oil)', 'אוויר דחוס (Air Blast)', 'מגנטי (Magnetic)'],
  disconnectorType: ['מנתק עומס (Load Break)', 'מנתק הארקה (Earthing)', 'מנתק תלת-מצבי (3-Position)', 'מנתק מסתובב (Rotary)', 'מנתק ליניארי (Linear)'],
  protectionRelay: ['זרם יתר 50/51', 'דיפרנציאלי 87', 'מרחק 21', 'תדר 81', 'מתח 27/59', 'כיווני 67', 'קרקע/הארקה 50N/51N'],
  voltageUnits: ['V', 'kV'],
  currentUnits: ['A', 'kA'],
  breakingUnits: ['kA', 'MVA'],
} as const;

/** רשימת הבדיקה הוויזואלית של לוח (facilities[].hvVisualChecks) — לברירת המחדל של לוח חדש, כמו בישן. */
const HV_VISUAL_IDS: Array<[string, string]> = [
  ['hv-mfr-sign', 'שילוט זיהוי ללוח חשמל כולל הצהרת יצרן להתאמה לתקן'], ['hv-panel-plans-match', 'התאמת הלוח והתאמים לתכניות'],
  ['hv-sign-plans-match', 'התאמת השילוט על גבי הלוח לתכניות'], ['hv-breakers-plans-match', 'התאמה של מפסקים ומנתקים לתכניות'],
  ['hv-surge-protectors-plans-match', 'התאמה של מגני נחשולי מתח לתכניות'], ['hv-connectors-insulators', 'שלמות מחברים ומכודדים'],
  ['hv-panel-grounding', 'קיום ותקינות הארקת הלוח'], ['hv-connection-accessories', 'שלמות אביזרי חיבור'], ['hv-safety-clearances', 'קיום מרווחי בטיחות תקינים'],
  ['hv-single-line-diagram', 'קיום תרשים חד-קווי עדכני'], ['hv-fire-equipment', 'קיום ציוד כיבוי אש מתאים'], ['hv-emergency-disconnect-btn', 'תקינות לחצן ניתוק בחירום'],
  ['hv-metal-services-grounding', 'תקינות הארקת השירותים המתכתיים בחדר'], ['hv-room-lighting', 'תקינות תאורה בחדר'],
  ['hv-emergency-lighting-exit', 'הימצאות ותקינות תאורת חירום ושלטי יציאה'], ['hv-ppe', 'קיום ותקינות ציוד מיגון אישי (כפפות, מוט, שטיח)'],
  ['hv-panel-fixation', 'קיבוע תקני של הלוח'], ['hv-doors-locks', 'תקינות דלתות ומנעולים'], ['hv-id-per-signage', 'זיהוי בהתאם לשילוט וליעוד'],
  ['hv-crossings-check', 'זיהוי ובדיקת הצלבות'], ['hv-cleanliness', 'ניקיון הלוח וחדר החשמל'], ['hv-dgpt', 'בדיקת DGPT'], ['hv-thermographic-scan', 'סריקה תרמוגרפית'],
  ['hv-visual-inspection-generic', 'בדיקה ויזואלית'], ['hv-cell-sealing', 'אטימות של התא'], ['hv-safety-distances-check', 'בדוק מרחקי בטיחות'],
  ['hv-panel-ground-fixation', 'בדיקת חיזוק הלוח לקרקע'], ['hv-buttons-lights-protections', 'שלמות לחצנים נורות והגנות'], ['hv-corrosion-rust', 'קורוזיה וחלודה על חלקי הלוח'],
  ['hv-bolt-tightening-torque', 'חיזוק ברגים (מד-מומנט)'], ['hv-grounding-busbar-connection', 'בדיקת חיבור הארקות לפס צבירה'], ['hv-temperature-sensors', 'בדיקת חיישני טמפרטורה'],
  ['hv-room-ventilation-system', 'בדיקת מערכת אוורור החדר'], ['hv-megger-5kv-test', 'בדיקת התנגדות ("מגר" 5KV)'], ['hv-grounding-test', 'בדיקת הארקות'],
];

/* ------------------------------ מבנה הנתונים ------------------------------ */

export interface MeasurementCT { type: string; model: string; va: string; alf: string; cls: string; ratio: string }
export interface ProtectionCT { manufacturer: string; model: string; serialNo: string; secondaryCurrent: string; busbarWithstand: string }
export interface SummaryCT { type: string; model: string; va: string; alf: string; ratio: string }

export interface AssemblyDetails {
  name: string; manufacturer: string; model: string; serialNo: string; yearOfManufacture: string;
  ratedVoltage: string; ratedVoltageUnit: string; ratedCurrent: string; ratedCurrentUnit: string;
  breakingCapacity: string; breakingCapacityUnit: string; numberOfCells: string; insulationType: string;
  standard: string; installLocation: string; notes: string;
  measurementCT: MeasurementCT; protectionCT: ProtectionCT; summaryCT: SummaryCT;
  [legacyField: string]: unknown;
}

export interface MainSwitchgear {
  notes: string; cabinetDetails: string;
  /** מפת אינדקס → 'ok' | 'bad' | 'na' | '' (מפתחות מחרוזת, כמו emptyStatusMap בישן). */
  checklist: Record<string, string>;
  panelRows: unknown[];
  assemblyDetails: AssemblyDetails;
  [legacyField: string]: unknown;
}

export interface HvCell {
  cellType: string; cellTypeOther: string; cellName: string; cellNumber: string; manufacturer: string; model: string; serialNo: string;
  yearOfManufacture: string; ratedVoltage: string; ratedVoltageUnit: string; ratedCurrent: string; ratedCurrentUnit: string;
  breakingCapacity: string; breakingCapacityUnit: string; insulationType: string; breakerType: string; disconnectorType: string;
  groundingType: string; protectionRelay: string; ct: string; vt: string; description: string; notes: string;
  [legacyField: string]: unknown;
}

export interface SummaryItem { number: number; text: string }

export interface MainPanelReport {
  protectionMethod: string; electricalApproval: string; accompaniedBy: string; testInstruments: unknown[];
  facilities: unknown[];
  summaryItems: SummaryItem[];
  mainSwitchgear: MainSwitchgear;
  hvCells: HvCell[];
  insulationTests: InsulationTable;
  [legacyField: string]: unknown;
}

export function makePanelId(): string {
  return 'panel_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export const emptyStatusMap = (n: number): Record<string, string> => Object.fromEntries(Array.from({ length: n }, (_, i) => [String(i), '']));

export const makeAssemblyDetails = (): AssemblyDetails => ({
  name: '', manufacturer: '', model: '', serialNo: '', yearOfManufacture: '',
  ratedVoltage: '', ratedVoltageUnit: 'kV', ratedCurrent: '', ratedCurrentUnit: 'A',
  breakingCapacity: '', breakingCapacityUnit: 'kA', numberOfCells: '', insulationType: '',
  standard: '', installLocation: '', notes: '',
  measurementCT: { type: '', model: '', va: '', alf: '', cls: '', ratio: '' },
  protectionCT: { manufacturer: '', model: '', serialNo: '', secondaryCurrent: '', busbarWithstand: '' },
  summaryCT: { type: '', model: '', va: '', alf: '', ratio: '' },
});

export const makeHvCell = (): HvCell => ({
  cellType: '', cellTypeOther: '', cellName: '', cellNumber: '', manufacturer: '', model: '', serialNo: '',
  yearOfManufacture: '', ratedVoltage: '', ratedVoltageUnit: 'kV', ratedCurrent: '', ratedCurrentUnit: 'A',
  breakingCapacity: '', breakingCapacityUnit: 'kA', insulationType: '', breakerType: '', disconnectorType: '',
  groundingType: '', protectionRelay: '', ct: '', vt: '', description: '', notes: '',
});

/** makeMainPanelFacility בישן — כדי שדוח חדש מהחדשה ייראה בישנה בדיוק כמו דוח חדש שלה. */
export function makeLegacyFacility(): Record<string, unknown> {
  return {
    id: makePanelId(), name: '', showFacilityTitle: true, facilityLocation: '',
    electricalPanelEnabled: true, panelType: '', workNumber: '', panelStandard: '',
    panelDetection: '', panelDisconnect: '', panelExtinguish: '', panelTransferSystem: '',
    manufacturer: '', nominalVoltage: '', nominalCurrent: '', voltageTransformerModel: '', voltageTransformerRatio: '',
    hvVisualChecksEnabled: false,
    hvVisualChecks: HV_VISUAL_IDS.map(([id, name]) => ({ id, name, status: '', notes: '' })),
    cellsEnabled: false, cells: [], powerSuppliesEnabled: false, powerSupplies: [], testItems: [], selectedEquipmentIds: [],
  };
}

const createEmpty = (): MainPanelReport => ({
  protectionMethod: '', electricalApproval: '', accompaniedBy: '', testInstruments: [],
  facilities: [makeLegacyFacility()],
  summaryItems: [],
  mainSwitchgear: { notes: '', cabinetDetails: '', checklist: emptyStatusMap(MAIN_SWITCHGEAR_CHECKLIST.length), panelRows: [], assemblyDetails: makeAssemblyDetails() },
  hvCells: [],
  insulationTests: makeInsulationTable(),
});

export function normalizeMainPanel(raw: unknown): MainPanelReport {
  const d = mergeDefaults(createEmpty(), raw);
  const ms = mergeDefaults(createEmpty().mainSwitchgear, d.mainSwitchgear);
  ms.assemblyDetails = mergeDefaults(makeAssemblyDetails(), ms.assemblyDetails);
  // מפת הסטטוסים — מפתחות כמחרוזת; פריטים חדשים (בסוף הרשימה) מקבלים ''
  const cl: Record<string, string> = {};
  MAIN_SWITCHGEAR_CHECKLIST.forEach((_, i) => { const v = (ms.checklist as Record<string, unknown>)[i]; cl[String(i)] = typeof v === 'string' ? v : ''; });
  for (const [k, v] of Object.entries(ms.checklist)) if (!(k in cl)) cl[k] = v; // לא מוחקים מפתחות לא מוכרים
  ms.checklist = cl;
  d.mainSwitchgear = ms;
  d.hvCells = (Array.isArray(d.hvCells) ? d.hvCells : []).map((c) => mergeDefaults(makeHvCell(), c));
  d.insulationTests = normalizeInsulationTable(d.insulationTests);
  d.summaryItems = (Array.isArray(d.summaryItems) ? d.summaryItems : []).map((x, i) => mergeDefaults({ number: i + 1, text: '' }, x));
  if (!Array.isArray(d.facilities)) d.facilities = [makeLegacyFacility()];
  return d;
}

/* ------------------------------ פעולות ------------------------------ */

export function renumberSummary(items: SummaryItem[]): SummaryItem[] {
  return items.map((s, i) => ({ ...s, number: i + 1 }));
}

export function duplicateCell(cells: HvCell[], i: number): HvCell[] {
  if (!cells[i]) return cells;
  const next = [...cells];
  next.splice(i + 1, 0, structuredClone(cells[i]));
  return next;
}

/** הערה לפריט בבדיקה הוויזואלית — state.itemNotes["mainPanelReport.mainSwitchgear.checklist|i"]. */
export function itemNoteKey(i: number): string {
  return `${ITEM_NOTES_PATH}|${i}`;
}

export function readItemNotes(data: ReportData): Record<string, string> {
  const n = data.itemNotes;
  return n && typeof n === 'object' && !Array.isArray(n) ? (n as Record<string, string>) : {};
}

export function writeItemNote(data: ReportData, i: number, text: string): void {
  const notes = { ...readItemNotes(data) };
  if (text.trim()) notes[itemNoteKey(i)] = text; else delete notes[itemNoteKey(i)];
  data.itemNotes = notes;
}

export function cellTitle(c: HvCell, i: number): string {
  return `תא ${i + 1}${c.cellName ? ' — ' + c.cellName : ''}`;
}

/* ------------------------------ ליקויים ------------------------------ */

function switchgearFindings(d: MainPanelReport, notes: Record<string, string>): Finding[] {
  return MAIN_SWITCHGEAR_CHECKLIST.flatMap((label, i) => {
    if (d.mainSwitchgear.checklist[String(i)] !== 'bad') return [];
    const note = notes[itemNoteKey(i)];
    return [{ where: 'מסדר מתח גבוה', text: note ? `${label} — ${note}` : label }];
  });
}

/** ליקויים בלוחות (facilities) — לא נערכים בחדשה, אבל נספרים כמו ב-hasMainPanelDefect. */
function legacyFacilityDefects(d: MainPanelReport): Finding[] {
  return d.facilities.flatMap((f) => {
    const fac = (f && typeof f === 'object' ? f : {}) as { name?: string; hvVisualChecks?: Array<{ name?: string; status?: string }>; testItems?: Array<{ name?: string; status?: string }> };
    const where = fac.name || 'לוח';
    return [
      ...(fac.hvVisualChecks ?? []).filter((h) => h?.status === 'X').map((h) => ({ where, text: h.name || 'בדיקה ויזואלית' })),
      ...(fac.testItems ?? []).filter((t) => t?.status === 'X').map((t) => ({ where, text: t.name || 'פריט בדיקה' })),
    ];
  });
}

export function collectMainPanelDefects(d: MainPanelReport, data?: ReportData): Finding[] {
  const notes = data ? readItemNotes(data) : {};
  return [...switchgearFindings(d, notes), ...insulationFindings(d.insulationTests, 'מסדר מתח גבוה'), ...legacyFacilityDefects(d)];
}

/** hasMainPanelDefect בישן: ליקוי באחד מהסעיפים, או אישור חשמול שאינו "מאושר". */
export function hasMainPanelDefect(d: MainPanelReport, data: ReportData): boolean {
  const approval = readApproval(data);
  return collectMainPanelDefects(d, data).length > 0 || (!!approval && approval !== APPROVAL_OPTIONS[0]);
}

export function appendDefectsToSummary(d: MainPanelReport, defects: Finding[]): MainPanelReport {
  const existing = new Set(d.summaryItems.map((s) => s.text.trim()));
  const fresh = defects.map((f) => `${f.where}: ${f.text}`).filter((t) => !existing.has(t));
  return { ...d, summaryItems: renumberSummary([...d.summaryItems, ...fresh.map((text) => ({ number: 0, text }))]) };
}

/* ------------------------------ פלט ------------------------------ */

const measure = (v: string, unit: string) => (v ? `${v} ${unit || ''}`.trim() : '');
const kv = (caption: string, pairs: Array<[string, string]>): Block | null => {
  const rows = pairs.filter(([, v]) => v).map(([label, value]) => ({ label, value }));
  return rows.length ? { kind: 'fields', caption, rows } : null;
};
const present = <T,>(xs: Array<T | null>) => xs.filter((x): x is T => x !== null);

function switchgearSections(d: MainPanelReport, data: ReportData): DocumentSection[] {
  const ad = d.mainSwitchgear.assemblyDetails, m = ad.measurementCT, p = ad.protectionCT, s = ad.summaryCT;
  const details = present<Block>([
    kv('פרטי מסדר מתח גבוה', [
      ['שם המסדר', ad.name], ['יצרן', ad.manufacturer], ['דגם', ad.model], ['מספר סידורי', ad.serialNo], ['שנת ייצור', ad.yearOfManufacture],
      ['מתח נקוב', measure(ad.ratedVoltage, ad.ratedVoltageUnit)], ['זרם נקוב', measure(ad.ratedCurrent, ad.ratedCurrentUnit)],
      ['כושר ניתוק', measure(ad.breakingCapacity, ad.breakingCapacityUnit)], ['מספר תאים', ad.numberOfCells], ['סוג בידוד', ad.insulationType],
      ['תקן', ad.standard], ['מיקום התקנה', ad.installLocation],
    ]),
    ad.notes.trim() ? { kind: 'paragraph', text: `הערות למסדר: ${ad.notes.trim()}` } : null,
    kv('משנה זרם מדידה', [['סוג', m.type], ['דגם', m.model], ['הספק (VA)', m.va], ['ALF', m.alf], ['CLASS', m.cls], ['יחס זרם', m.ratio]]),
    kv('משנה זרם הגנה', [['יצרן', p.manufacturer], ['דגם', p.model], ['מספר סידורי', p.serialNo], ['זרם משני (A)', p.secondaryCurrent], ['עמידות פסי צבירה בזרם קצר', p.busbarWithstand]]),
    kv('משנה זרם מסכם', [['סוג', s.type], ['דגם', s.model], ['הספק (VA)', s.va], ['ALF', s.alf], ['יחס זרם', s.ratio]]),
  ]);
  const notes = readItemNotes(data);
  const checklistRows = MAIN_SWITCHGEAR_CHECKLIST.flatMap((label, i) => {
    const st = d.mainSwitchgear.checklist[String(i)];
    const note = notes[itemNoteKey(i)] ?? '';
    return st || note ? [[label, SWITCHGEAR_STATUS_LABEL[st] ?? st ?? '', note]] : [];
  });
  const visual = present<Block>([
    checklistRows.length ? { kind: 'table', caption: 'בדיקה ויזואלית — מסדר', columns: ['תיאור הבדיקה', 'סטטוס', 'הערות'], rows: checklistRows } : null,
    d.mainSwitchgear.cabinetDetails.trim() ? { kind: 'paragraph', text: `פרטי תאים וציוד: ${d.mainSwitchgear.cabinetDetails.trim()}` } : null,
    d.mainSwitchgear.notes.trim() ? { kind: 'paragraph', text: `הערות: ${d.mainSwitchgear.notes.trim()}` } : null,
  ]);
  return present<DocumentSection>([
    details.length ? { id: 'mp-switchgear', zone: 'content', title: 'מסדר מתח גבוה', icon: '🗄️', blocks: details } : null,
    visual.length ? { id: 'mp-switchgear-visual', zone: 'content', title: 'מסדר מתח גבוה — בדיקה ויזואלית', icon: '🔍', blocks: visual } : null,
  ]);
}

function cellsSection(d: MainPanelReport): DocumentSection | null {
  // רק תאים עם נתונים מזהים (כמו relevantHvCells בישן)
  const cells = d.hvCells.map((c, i) => ({ c, i })).filter(({ c }) => c.cellType || c.cellName || c.manufacturer || c.serialNo);
  if (!cells.length) return null;
  return {
    id: 'mp-hv-cells', zone: 'content', title: 'תאי מתח גבוה', icon: '🔌',
    blocks: cells.map(({ c, i }) => ({
      kind: 'facility' as const, title: cellTitle(c, i),
      subtitle: [c.cellType, c.manufacturer].filter(Boolean).join(' · ') || undefined,
      blocks: present<Block>([
        kv('', [
          ['סוג תא', c.cellType === 'אחר' && c.cellTypeOther ? c.cellTypeOther : c.cellType], ['שם התא', c.cellName], ['מספר תא', c.cellNumber],
          ['יצרן', c.manufacturer], ['דגם', c.model], ['מספר סידורי', c.serialNo], ['שנת ייצור', c.yearOfManufacture],
          ['מתח נקוב', measure(c.ratedVoltage, c.ratedVoltageUnit)], ['זרם נקוב', measure(c.ratedCurrent, c.ratedCurrentUnit)],
          ['כושר ניתוק', measure(c.breakingCapacity, c.breakingCapacityUnit)], ['סוג בידוד', c.insulationType], ['סוג מפסק', c.breakerType],
          ['סוג מנתק', c.disconnectorType], ['סוג הארקה', c.groundingType], ['ממסר הגנה', c.protectionRelay], ['CT', c.ct], ['VT', c.vt],
        ]),
        c.description.trim() ? { kind: 'paragraph', text: `תיאור: ${c.description.trim()}` } : null,
        c.notes.trim() ? { kind: 'paragraph', text: `הערות: ${c.notes.trim()}` } : null,
      ]),
    })),
  };
}

export const mainPanelService = defineReportService<MainPanelReport>('MAIN_PANEL', {
  legacyKey: LEGACY_KEY,
  showFindingsTable: false, // ממצאים מסכמים ידניים (עם כפתור העתקת ליקויים) — כמו בישן
  createEmpty,
  normalize: normalizeMainPanel,
  validate: (d, data): ValidationIssue[] => {
    const issues: ValidationIssue[] = [];
    const pending = MAIN_SWITCHGEAR_CHECKLIST.filter((_, i) => !d.mainSwitchgear.checklist[String(i)]).length;
    if (pending === MAIN_SWITCHGEAR_CHECKLIST.length) issues.push({ path: 'mainSwitchgear.checklist', message: 'הבדיקה הוויזואלית של המסדר ריקה', severity: 'warning' });
    else if (pending) issues.push({ path: 'mainSwitchgear.checklist', message: `${pending} מתוך ${MAIN_SWITCHGEAR_CHECKLIST.length} פריטי בדיקה ויזואלית ללא סטטוס (לא יודפסו)`, severity: 'warning' });
    const notes = readItemNotes(data);
    MAIN_SWITCHGEAR_CHECKLIST.forEach((label, i) => {
      if (d.mainSwitchgear.checklist[String(i)] === 'bad' && !notes[itemNoteKey(i)]?.trim()) issues.push({ path: `mainSwitchgear.checklist.${i}`, message: `"${label}" סומן לא תקין בלי הערה`, severity: 'warning' });
    });
    if (!d.mainSwitchgear.assemblyDetails.name && !d.mainSwitchgear.assemblyDetails.serialNo) issues.push({ path: 'mainSwitchgear.assemblyDetails.name', message: 'חסר שם או מספר סידורי למסדר', severity: 'warning' });
    d.hvCells.forEach((c, i) => {
      if (!(c.cellType || c.cellName || c.manufacturer || c.serialNo)) issues.push({ path: `hvCells.${i}`, message: `תא ${i + 1}: ריק — לא יודפס`, severity: 'warning' });
    });
    if (!d.insulationTests.rows.some(rowHasData)) issues.push({ path: 'insulationTests', message: 'לא הוזנו בדיקות בידוד', severity: 'warning' });
    if (!readApproval(data)) issues.push({ path: 'approvalStatus', message: 'לא נבחר "אישור חשמול"', severity: 'error' });
    else if (readApproval(data) === APPROVAL_OPTIONS[0] && collectMainPanelDefects(d, data).length)
      issues.push({ path: 'approvalStatus', message: '"מתקן חשמל מאושר" נבחר אך יש פריטים שסומנו לא תקין', severity: 'warning' });
    return issues;
  },
  buildSections: (d, data): DocumentSection[] => {
    const ins = insulationBlock(d.insulationTests);
    const summary = d.summaryItems.filter((s) => s.text && s.text.trim());
    return present<DocumentSection>([
      ...switchgearSections(d, data),
      cellsSection(d),
      ins ? { id: 'mp-insulation', zone: 'content', title: 'בדיקות בידוד', icon: '⚡', blocks: [ins] } : null,
      summary.length ? { id: 'mp-summary', zone: 'summary', title: 'ממצאים מסכמים', icon: '📋', blocks: [{ kind: 'notes', items: summary.map((s) => s.text.trim()) }] } : null,
    ]);
  },
  findings: (d) => collectMainPanelDefects(d),
  hasDefect: (d, data) => hasMainPanelDefect(d, data),
});
