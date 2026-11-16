/**
 * TRANSFORMER_INSPECTION — דוח בדיקת שנאי מתח גבוה (קידומת TR, תיקיית "בדיקות מתח גבוה").
 *
 * הועבר במלואו מהאפליקציה הישנה (v2.2.552). מבנה הנתונים זהה 1:1 ונשמר באותו מפתח
 * (report_data.transformerInspectionReport), כך ששתי האפליקציות פותחות ועורכות את אותו דוח:
 *   - newState().transformerInspectionReport          → createEmpty()
 *   - makeTransformerInspectionItem(num)               → makeTransformerItem()
 *   - makeTransformerInspectionGroundingBlock()        → makeGroundingBlock()
 *   - TRANSFORMER_INSPECTION_CHECKLIST / _INSULATION_TESTS / _*_OPTIONS
 *   - MAIN_PANEL_STATUS_OPTIONS ("V","X","N/A")        → TI_STATUS
 *   - buildTransformerInspectionReportBlocks()         → buildSections() (אותם שדות, אותם סינונים)
 *   - שכפול/מחיקה (data-duptransformer/deltransformer) → duplicateTransformer / removeTransformer
 *
 * סעיפים: 01 פרטי המתקן (משותף), 02 שנאים, 03 ממצאים מסכמים, 04 מסקנה; הצהרות מ-05.
 *
 * לא כאן (משותף ל-SMA / שנאי / לוח ראשי): ממסרי הגנה — state.protectionRelays. הנתונים נשמרים
 * כמו שהם בשמירה מהאפליקציה החדשה; העריכה וההדפסה שלהם נשארות באפליקציה הישנה עד העברת המודול.
 */
import type { Block, DocumentSection } from '@/core/reportModel';
import { defineReportService, mergeDefaults, type Finding, type ValidationIssue } from '../ReportTypeService';

/* ------------------------------ קבועים (1:1 מהישן) ------------------------------ */

export const TI_CHECKLIST = [
  'מרחקים תקינים מסביב לשנאי',
  'ניקיון השנאי',
  'שילוט אזהרה על כלוב השנאי - זהירות, אין להיכנס לפני הפסקה וקיצור מקורות הזנה',
  'מצב בידודים (Bushings) - ללא סדקים או נזק',
  'קיום ותקינות הארקת השנאי',
  'קיום גישה בטוחה לתחזוקה',
  'תקינות מערכת איוורור/קירור',
  'קיום ותקינות מערכת גילוי אש',
  'קיום ותקינות תאורת חירום בחדר שנאים',
  'פתיחת דלת כלפי חוץ',
  'קיום ותקינות הארקת שירותים מתכתיים בסביבת השנאי',
  'תקינות לחצן ניתוק בחירום',
  'קיום ותקינות מאצרת שמן',
  'התאמת השנאי לתכניות',
  'התאמת השילוט של המבטח המזין לתכניות',
  'תקינות פעילות ממסר הגנת טמפרטורה לקבלת התראה',
  'תקינות פעילות ממסר הגנת טמפרטורה לקבלת הפסקה',
  'קבלת התראה במערכת הבקרה מיחידת DGPT',
  'קבלת הפסקה מיחידת ה-DGPT',
  'זיהוי בהתאם לשילוט וליעוד',
  'זיהוי ובדיקת הצלבות',
  'תקינות דלתות ומנעולי חדר שנאים',
] as const;

export const TI_INSULATION_TESTS = [
  { key: 'hvEarth', label: 'גבוה - הארקה (HV to Earth)' },
  { key: 'hvScreen', label: 'גבוה - סיכוך (HV to Screen)' },
  { key: 'lvEarth', label: 'נמוך - הארקה (LV to Earth)' },
  { key: 'hvLv', label: 'גבוה - נמוך (HV to LV)' },
  { key: 'screenEarth', label: 'סיכוך - הארקה (Screen to Earth)' },
] as const;

export const TI_OPTIONS = {
  primaryVoltage: ['6.6 kV', '11 kV', '12.6 kV', '22 kV', '33 kV'],
  secondaryVoltage: ['400 V'],
  manufacturer: ['ABB', 'Ardan', 'Siemens', 'Schneider Electric', 'GE', 'Toshiba', 'Hyundai', 'Hitachi', 'Ormazabal', 'Tamini', 'TMC'],
  type: ['שמן אטום', 'שמן עם מיכל התפשטות', 'יצוק'],
  connectionGroup: ['Dyn11', 'Dyn5', 'Dyn1', 'Yyn0', 'Yzn11', 'Dd0', 'Dyn11yn11'],
  conclusion: ['תקין', 'לא תקין'],
} as const;

/** הערכים שנשמרים בפועל (MAIN_PANEL_STATUS_OPTIONS) + התוויות שלהם. "" = לא נבחר. */
export const TI_STATUS = ['V', 'X', 'N/A'] as const;
export type TiStatus = (typeof TI_STATUS)[number] | '';
export const TI_STATUS_LABEL: Record<string, string> = { V: 'תקין', X: 'לא תקין', 'N/A': 'לא רלוונטי', '': '—' };

/* ------------------------------ מבנה הנתונים ------------------------------ */

export interface GroundingBlock {
  parallelConductors: string;
  crossSection: string;
  conductorType: string;
}

export interface ChecklistEntry { status: TiStatus | string; notes: string }
export interface InsulationEntry { key: string; enabled: boolean; status: TiStatus | string; value: string }

export interface TransformerItem {
  id: string;
  num: number;
  serialNo: string; model: string; manufacturer: string;
  powerKVA: string; primaryVoltageKV: string; secondaryVoltageV: string;
  connectionGroup: string; yearOfManufacture: string; transformerType: string;
  shortCircuitVoltagePercent: string;
  groundingMethod: GroundingBlock;
  groundingProtection: GroundingBlock;
  checklistEnabled: boolean;
  checklist: ChecklistEntry[];
  insulationEnabled: boolean;
  insulationTests: InsulationEntry[];
  sectionNotes: string;
  [legacyField: string]: unknown;
}

export interface SummaryItem { number: number; text: string }

export interface TransformerInspectionReport {
  /** קיימים במבנה הישן אך לא נערכים/מודפסים שם (הועברו לעמוד השער) — נשמרים כמו שהם. */
  testInstrumentsText: string;
  accompaniedBy: string;
  transformers: TransformerItem[];
  summaryItems: SummaryItem[];
  conclusion: { status: string; freeText: string };
  [legacyField: string]: unknown;
}

export const LEGACY_KEY = 'transformerInspectionReport';

/** אותו פורמט כמו makePanelId() בישן. */
export function makePanelId(): string {
  return 'panel_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export const makeGroundingBlock = (): GroundingBlock => ({ parallelConductors: '', crossSection: '', conductorType: '' });

export function makeTransformerItem(num = 1): TransformerItem {
  return {
    id: makePanelId(), num,
    serialNo: '', model: '', manufacturer: '',
    powerKVA: '', primaryVoltageKV: '', secondaryVoltageV: '',
    connectionGroup: '', yearOfManufacture: '', transformerType: '',
    shortCircuitVoltagePercent: '',
    groundingMethod: makeGroundingBlock(),
    groundingProtection: makeGroundingBlock(),
    checklistEnabled: true,
    checklist: TI_CHECKLIST.map(() => ({ status: '', notes: '' })),
    insulationEnabled: true,
    insulationTests: TI_INSULATION_TESTS.map((t) => ({ key: t.key, enabled: false, status: '', value: '' })),
    sectionNotes: '',
  };
}

const createEmpty = (): TransformerInspectionReport => ({
  testInstrumentsText: '', accompaniedBy: '',
  transformers: [makeTransformerItem(1)],
  summaryItems: [],
  conclusion: { status: '', freeText: '' },
});

/** כמו רשת הביטחון בישן (deepMergeGeneric(makeTransformerInspectionItem(...), tr)) + ריפוד מערכים קצרים. */
function normalizeTransformer(raw: unknown, i: number): TransformerItem {
  const rawNum = (raw as { num?: number } | null)?.num;
  const t = mergeDefaults(makeTransformerItem(rawNum || i + 1), raw);
  if (typeof t.id !== 'string' || !t.id) t.id = makePanelId();
  t.checklist = TI_CHECKLIST.map((_, ci) => mergeDefaults({ status: '', notes: '' }, t.checklist[ci]));
  t.insulationTests = TI_INSULATION_TESTS.map((def, ii) => {
    const found = t.insulationTests.find((r) => r && r.key === def.key) ?? t.insulationTests[ii];
    return { ...mergeDefaults({ key: def.key, enabled: false, status: '', value: '' }, found), key: def.key };
  });
  return t;
}

export function normalizeReport(raw: unknown): TransformerInspectionReport {
  const d = mergeDefaults(createEmpty(), raw);
  d.transformers = (Array.isArray(d.transformers) ? d.transformers : []).map(normalizeTransformer);
  // בישן: רשימה ריקה → שנאי ברירת מחדל אוטומטי
  if (!d.transformers.length) d.transformers = [makeTransformerItem(1)];
  d.summaryItems = (Array.isArray(d.summaryItems) ? d.summaryItems : []).map((s, i) => ({
    ...mergeDefaults({ number: i + 1, text: '' }, s),
  }));
  return d;
}

/* ------------------------------ פעולות עריכה (טהורות) ------------------------------ */

/** שכפול: עותק מלא מיד אחרי המקור, id חדש, מספר סידורי מתאפס — כמו בישן. */
export function duplicateTransformer(d: TransformerInspectionReport, id: string): TransformerInspectionReport {
  const idx = d.transformers.findIndex((t) => t.id === id);
  if (idx === -1) return d;
  const clone: TransformerItem = { ...structuredClone(d.transformers[idx]), id: makePanelId(), serialNo: '' };
  const transformers = [...d.transformers];
  transformers.splice(idx + 1, 0, clone);
  return { ...d, transformers };
}

/** מחיקה: אסור למחוק את השנאי האחרון (כמו בישן). מחזיר null אם נחסם. */
export function removeTransformer(d: TransformerInspectionReport, id: string): TransformerInspectionReport | null {
  if (d.transformers.length <= 1) return null;
  return { ...d, transformers: d.transformers.filter((t) => t.id !== id) };
}

export function addTransformer(d: TransformerInspectionReport): TransformerInspectionReport {
  return { ...d, transformers: [...d.transformers, makeTransformerItem(d.transformers.length + 1)] };
}

/** ממצאים מסכמים — מספור רציף 1..n (בישן מחיקה השאירה חורים במספור). */
export function renumberSummary(items: SummaryItem[]): SummaryItem[] {
  return items.map((s, i) => ({ ...s, number: i + 1 }));
}

/** כל הפריטים שסומנו "לא תקין" — לכפתור "העתק ליקויים לממצאים". */
export function collectDefects(d: TransformerInspectionReport): Finding[] {
  return d.transformers.flatMap((t, ti) => {
    const where = transformerTitle(t, ti);
    return [
      ...(t.checklistEnabled
        ? t.checklist.flatMap((c, ci) => (c.status === 'X' ? [{ where, text: c.notes ? `${TI_CHECKLIST[ci]} — ${c.notes}` : TI_CHECKLIST[ci] }] : []))
        : []),
      ...(t.insulationEnabled
        ? t.insulationTests.flatMap((r, ii) => (r.enabled && r.status === 'X' ? [{ where, text: `בדיקת בידוד ${TI_INSULATION_TESTS[ii].label}${r.value ? ` (${r.value} MΩ)` : ''}` }] : []))
        : []),
    ];
  });
}

/** מוסיף לממצאים המסכמים ליקויים שעוד לא מופיעים שם (לא מכפיל). extra — למשל ליקויי ממסרי הגנה. */
export function appendDefectsToSummary(d: TransformerInspectionReport, extra: Finding[] = []): TransformerInspectionReport {
  const existing = new Set(d.summaryItems.map((s) => s.text.trim()));
  const fresh = [...collectDefects(d), ...extra].map((f) => `${f.where}: ${f.text}`).filter((t) => !existing.has(t));
  return { ...d, summaryItems: renumberSummary([...d.summaryItems, ...fresh.map((text) => ({ number: 0, text }))]) };
}

export function transformerTitle(t: TransformerItem, index: number): string {
  return t.model ? `שנאי מספר ${index + 1} — ${t.model}` : `שנאי מספר ${index + 1}`;
}

/* ------------------------------ פלט המסמך ------------------------------ */

const kv = (caption: string, pairs: Array<[string, string]>): Block | null => {
  const rows = pairs.filter(([, v]) => v).map(([label, value]) => ({ label, value }));
  return rows.length ? { kind: 'fields', caption, rows } : null;
};

function transformerBlocks(t: TransformerItem): Block[] {
  const gm = t.groundingMethod, gp = t.groundingProtection;
  const blocks: Array<Block | null> = [
    kv('פרטי שנאי', [
      ['מספר סידורי', t.serialNo], ['דגם', t.model], ['יצרן', t.manufacturer],
      ['הספק (kVA)', t.powerKVA], ['מתח ראשוני (kV)', t.primaryVoltageKV], ['מתח משני (V)', t.secondaryVoltageV],
      ['קבוצת חיבור', t.connectionGroup], ['שנת ייצור', t.yearOfManufacture], ['סוג שנאי', t.transformerType],
      ['דרגת מתח קצר Uk%', t.shortCircuitVoltagePercent],
    ]),
    kv('הארקת שיטה', [['מוליכים במקביל', gm.parallelConductors], ['חתך מוליך (ממ"ר)', gm.crossSection], ['סוג מוליך', gm.conductorType]]),
    kv('הארקת הגנה', [['מוליכים במקביל', gp.parallelConductors], ['חתך מוליך (ממ"ר)', gp.crossSection], ['סוג מוליך', gp.conductorType]]),
  ];
  // בדיקות ויזואליות — רק אם מופעל ויש לפחות סטטוס אחד; רק פריטים שסומנו (כמו בישן)
  if (t.checklistEnabled && t.checklist.some((c) => c.status)) {
    blocks.push({
      kind: 'table', caption: 'בדיקות ויזואליות', columns: ['תיאור הבדיקה', 'סטטוס', 'הערות'],
      rows: t.checklist.flatMap((c, ci) => (c.status ? [[TI_CHECKLIST[ci], TI_STATUS_LABEL[c.status] ?? c.status, c.notes]] : [])),
    });
  }
  // בדיקת בידוד — רק שורות מסומנות
  if (t.insulationEnabled && t.insulationTests.some((r) => r.enabled)) {
    blocks.push({
      kind: 'table', caption: 'בדיקת בידוד שנאי', columns: ['סוג בדיקה', 'תוצאה', 'ערך (MΩ)'],
      rows: t.insulationTests.flatMap((r, ii) => (r.enabled ? [[TI_INSULATION_TESTS[ii].label, TI_STATUS_LABEL[r.status] ?? r.status, r.value]] : [])),
    });
  }
  if (t.sectionNotes.trim()) blocks.push({ kind: 'paragraph', text: t.sectionNotes.trim() });
  return blocks.filter((b): b is Block => !!b);
}

export const transformerInspectionService = defineReportService<TransformerInspectionReport>('TRANSFORMER_INSPECTION', {
  legacyKey: LEGACY_KEY,
  // הסוג מנהל ממצאים בעצמו (ממצאים מסכמים); בלי טבלה אוטומטית — כמו ה-PDF הישן
  showFindingsTable: false,
  createEmpty,
  normalize: normalizeReport,
  validate: (d): ValidationIssue[] => {
    const issues: ValidationIssue[] = [];
    d.transformers.forEach((t, i) => {
      const name = transformerTitle(t, i);
      const p = `transformers.${i}`;
      if (!t.serialNo && !t.model) issues.push({ path: `${p}.serialNo`, message: `${name}: חסר מספר סידורי או דגם`, severity: 'warning' });
      if (t.checklistEnabled) {
        const pending = t.checklist.filter((c) => !c.status).length;
        if (pending) issues.push({ path: `${p}.checklist`, message: `${name}: ${pending} מתוך ${TI_CHECKLIST.length} בדיקות ויזואליות ללא סטטוס (לא יודפסו)`, severity: 'warning' });
        t.checklist.forEach((c, ci) => {
          if (c.status === 'X' && !c.notes.trim()) issues.push({ path: `${p}.checklist.${ci}.notes`, message: `${name}: "${TI_CHECKLIST[ci]}" סומן לא תקין בלי הערה`, severity: 'warning' });
        });
      }
      if (t.insulationEnabled) {
        t.insulationTests.forEach((r, ii) => {
          if (r.enabled && !r.status) issues.push({ path: `${p}.insulationTests.${ii}.status`, message: `${name}: בדיקת בידוד "${TI_INSULATION_TESTS[ii].label}" מסומנת בלי סטטוס`, severity: 'warning' });
          if (r.value && Number.isNaN(Number(r.value.replace(',', '.')))) issues.push({ path: `${p}.insulationTests.${ii}.value`, message: `${name}: ערך בידוד לא מספרי ("${r.value}")`, severity: 'warning' });
        });
      }
    });
    if (!d.conclusion.status) issues.push({ path: 'conclusion.status', message: 'לא נבחרה מסקנה (תקין / לא תקין)', severity: 'error' });
    if (d.conclusion.status === 'תקין' && collectDefects(d).length)
      issues.push({ path: 'conclusion.status', message: 'המסקנה "תקין" אך יש פריטים שסומנו לא תקין', severity: 'warning' });
    return issues;
  },
  buildSections: (d): DocumentSection[] => {
    const sections: DocumentSection[] = [{
      id: 'ti-transformers', zone: 'content', title: 'שנאים', icon: '🔋',
      blocks: d.transformers.map((t, i) => ({
        kind: 'facility' as const,
        title: transformerTitle(t, i),
        subtitle: [t.manufacturer, t.powerKVA && `${t.powerKVA} kVA`, t.primaryVoltageKV].filter(Boolean).join(' · ') || undefined,
        blocks: transformerBlocks(t),
      })),
    }];
    const summary = d.summaryItems.filter((s) => s.text && s.text.trim());
    if (summary.length) {
      sections.push({ id: 'ti-summary', zone: 'summary', title: 'ממצאים מסכמים', icon: '📋', blocks: [{ kind: 'notes', items: summary.map((s) => s.text.trim()) }] });
    }
    if (d.conclusion.status || d.conclusion.freeText) {
      const blocks: Block[] = [];
      if (d.conclusion.status) blocks.push({ kind: 'fields', rows: [{ label: 'מסקנה', value: d.conclusion.status }] });
      if (d.conclusion.freeText.trim()) blocks.push({ kind: 'paragraph', text: d.conclusion.freeText.trim() });
      sections.push({ id: 'ti-conclusion', zone: 'summary', title: 'מסקנה', icon: '✅', blocks });
    }
    return sections;
  },
  findings: collectDefects,
});
