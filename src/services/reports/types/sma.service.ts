/**
 * SMA — דוח תחזוקה: טיפול בממירי SMA / תחנות משנה.
 *
 * מחליף את שלד המתקנים. המבנה עוקב אחרי דוח השטח SMA-1099-09-2026
 * (אלמור אנרגיות מתחדשות, אתר ניר יצחק):
 *   עמוד שער (משותף) → תוכן עניינים → לכל תחנה/שנאי (TR1, TR2, …, מספר דינמי):
 *     בדיקה ויזואלית של הלוח, תאי מתח גבוה, שנאי + בדיקה ויזואלית קצרה,
 *     ניקיון ממיר (שם היצרן דינמי), בדיקת בידוד DAR
 *   ואז: ציוד בטיחות למתח גבוה, הערות, אישור, חתימה, תיעוד תמונות.
 *
 * נשמר ב-report_data.smaMaintenanceReport. אין באפליקציה הישנה מפתח זהה —
 * הישנה שומרת מפתחות עליונים לא מוכרים, אז דוח שנשמר כאן לא נמחק בשמירה משם.
 * כותרת וקידומת מספר הדוח לפי settings.inverterBrand (ברירת מחדל SMA).
 */
import type { Block, DocumentSection, ReportData } from '@/core/reportModel';
import { emptyMeta, emptySettings } from '@/core/reportModel';
import { REPORT_TYPES } from '@/core/reportTypes';
import { readApproval } from '@/services/shared/approval';
import { insulationBlock, insulationFindings, makeInsulationTable, normalizeInsulationTable, rowHasData, type InsulationTable } from '@/services/shared/insulation';
import { makePhotoEntry, writePhotos } from '@/services/shared/photos';
import { isPrintable, readRelays, relayFindings } from '@/services/shared/protectionRelays';
import { defineReportService, mergeDefaults, writeTypeData, type Finding, type ValidationIssue } from '../ReportTypeService';

export const LEGACY_KEY = 'smaMaintenanceReport';

/** נוסח הצהרת החשמלאי כפי שמודפס בדוח התחזוקה (שונה מעט מנוסח ברירת המחדל הגנרי). */
export const SMA_ELECTRICIAN_DECLARATION =
  'הריני מצהיר כי מתקן זה בוצע על ידי/נו לפי כללי המקצוע הטובים, בהתאם לחוק החשמל התשי"ד 1954 ותקנותיו ותקני מכון התקנים הישראלי, וכללי האספקה של חברת החשמל לישראל בע"מ ובאחריותו של בעל רישיון מתאים כמתחייב בחוק.';

/* ------------------------------ רשימות בדיקה (כלשונן בדוח) ------------------------------ */

/** בדיקה ויזואלית — לוח. זוגות (ימין, שמאל) כמו בטבלה המודפסת. */
export const PANEL_CHECKLIST = [
  'בדיקה ויזואלית',
  'אטימות של התא',
  'בדיקת חיזוק הלוח לקרקע',
  'שלמות לחצנים נורות והגנות',
  'קורוזיה וחלודה על חלקי הלוח',
  'חיזוק ברגים (מד-מומנט)',
  'בדיקת חיבור הארקות לפס צבירה',
  'בדיקת התנגדות ("מגר" 5KV)',
  'בדיקת הארקות',
  'התאמה של מגני נחשולי מתח לתכניות',
  'קיום ותקינות הארקת הלוח',
  'שלמות אביזרי חיבור',
  'תקינות הארקת השירותים המתכתיים בחדר',
  'תקינות דלתות ומנעולים',
] as const;

/** בדיקה ויזואלית קצרה של השנאי (מודפסת רק כשסומנה — בדוגמה רק ב-TR1). */
export const TRANSFORMER_VISUAL_CHECKLIST = [
  'בדיקה ויזואלית',
  'בדיקת חיזוק השנאי לקרקע',
  'שלמות לחצנים נורות והגנות',
] as const;

/** ניקיון ממיר. "תעלות היברור" כלשון הדוח המודפס. */
export const INVERTER_CLEANING_CHECKLIST = [
  'ניקיון קבלים',
  'ניקיון מפוח פנימי',
  'ניקיון סליל שנאי (תחתון)',
  'ניקיון שנאי בית ממיר',
  'ניקיון תעלות היברור',
  'ניקיון מסננים עליון חיצוני',
] as const;

export const HV_SAFETY_CHECKLIST = [
  'כפפות מ"ג',
  'קסדה',
  'משקפי מגן',
  'מקצרים',
  'בוחן מתח (למ"ג)',
  'ציוד כיבוי אש',
  'וו חילוץ',
  'בודק כפפות',
  'סט נתיכים',
  'בחדר מ"ג מותקן נוהל עזרה ראשונה',
  'בחדר מ"ג קיים סרטוט חד קווי',
] as const;

export const SMA_STATUS = [
  { value: 'ok', label: 'תקין', tone: 'ok' as const },
  { value: 'bad', label: 'לא תקין', tone: 'bad' as const },
  { value: 'na', label: 'לא רלוונטי', tone: 'na' as const },
] as const;

export const SMA_STATUS_PRINT: Record<string, string> = {
  ok: 'תקין ✓',
  bad: 'לא תקין ✕',
  na: 'לא רלוונטי',
};

export const SMA_OPTIONS = {
  cellType: ['תא כניסה', 'תא יציאה', 'תא שנאי', 'שמור', 'אחר'],
  manufacturer: ['Siemens', 'ABB', 'Schneider Electric', 'Ormazabal', 'EATON', 'AFCON'],
  insulationType: ['SF6 (GIS)', 'אוויר (AIS)', 'ואקום', 'מבודד מוצק'],
  breakerType: ['SF6', 'ואקום (Vacuum)', 'שמן (Oil)', 'אוויר דחוס (Air Blast)'],
  disconnectorType: ['מנתק עומס (Load Break)', 'מנתק הארקה (Earthing)', 'מנתק תלת-מצבי (3-Position)'],
  transformerManufacturer: ['SBG', 'ABB', 'Siemens', 'Ormazabal', 'Tamini', 'TMC'],
  transformerType: ['שמן', 'שמן אטום', 'יצוק', 'יבש'],
  connectionGroup: ['Dy11', 'Dyn11', 'Dyn5', 'Yyn0', 'Dd0'],
  voltageUnits: ['kV', 'V'],
  currentUnits: ['A', 'kA'],
  breakingUnits: ['kA', 'MVA'],
} as const;

/* ------------------------------ מבנה הנתונים ------------------------------ */

export interface CheckItem {
  /** מילוי בנרמול לפי הרשימה הקבועה. פריט עודף (מעבר לאורך הרשימה) שומר את התווית שלו. */
  label: string;
  status: string;
  note: string;
  [legacyField: string]: unknown;
}

export interface SmaCell {
  cellType: string;
  cellName: string;
  cellNumber: string;
  manufacturer: string;
  model: string;
  serialNo: string;
  yearOfManufacture: string;
  ratedVoltage: string;
  ratedVoltageUnit: string;
  ratedCurrent: string;
  ratedCurrentUnit: string;
  breakingCapacity: string;
  breakingCapacityUnit: string;
  insulationType: string;
  breakerType: string;
  disconnectorType: string;
  groundingType: string;
  notes: string;
  [legacyField: string]: unknown;
}

export interface SmaTransformer {
  manufacturer: string;
  serialNo: string;
  yearOfManufacture: string;
  powerKVA: string;
  nominalVoltage: string;
  shortCircuitVoltagePercent: string;
  connectionGroup: string;
  type: string;
  grade: string;
  checklist: CheckItem[];
  notes: string;
  [legacyField: string]: unknown;
}

export interface SmaStation {
  id: string;
  /** TR1, TR2… — ניתן לעריכה. */
  code: string;
  /** כינוי נוסף, למשל ST1. ריק = לא מודפס. */
  stationName: string;
  panelChecklist: CheckItem[];
  cells: SmaCell[];
  transformer: SmaTransformer;
  cleaning: CheckItem[];
  /** false = אין סעיף בידוד (כמו TR3 בדוח הדוגמה). */
  insulationEnabled: boolean;
  insulation: InsulationTable;
  notes: string;
  [legacyField: string]: unknown;
}

export interface SmaMaintenanceReport {
  stations: SmaStation[];
  safetyChecklist: CheckItem[];
  [legacyField: string]: unknown;
}

export function makeId(): string {
  return 'sma_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function makeChecks(labels: readonly string[]): CheckItem[] {
  return labels.map((label) => ({ label, status: '', note: '' }));
}

export function makeCell(): SmaCell {
  return {
    cellType: '', cellName: '', cellNumber: '', manufacturer: '', model: '', serialNo: '',
    yearOfManufacture: '', ratedVoltage: '', ratedVoltageUnit: 'kV', ratedCurrent: '', ratedCurrentUnit: 'A',
    breakingCapacity: '', breakingCapacityUnit: 'kA', insulationType: '', breakerType: '', disconnectorType: '',
    groundingType: '', notes: '',
  };
}

export function makeTransformer(): SmaTransformer {
  return {
    manufacturer: '', serialNo: '', yearOfManufacture: '', powerKVA: '', nominalVoltage: '',
    shortCircuitVoltagePercent: '', connectionGroup: '', type: '', grade: '',
    checklist: makeChecks(TRANSFORMER_VISUAL_CHECKLIST), notes: '',
  };
}

export function makeStation(num = 1): SmaStation {
  return {
    id: makeId(), code: `TR${num}`, stationName: '',
    panelChecklist: makeChecks(PANEL_CHECKLIST),
    cells: [],
    transformer: makeTransformer(),
    cleaning: makeChecks(INVERTER_CLEANING_CHECKLIST),
    insulationEnabled: true,
    insulation: makeInsulationTable(),
    notes: '',
  };
}

const createEmpty = (): SmaMaintenanceReport => ({
  stations: [makeStation(1)],
  safetyChecklist: makeChecks(HV_SAFETY_CHECKLIST),
});

function normalizeChecks(raw: unknown, labels: readonly string[]): CheckItem[] {
  const arr = Array.isArray(raw) ? raw : [];
  const known = labels.map((label, i) => ({ ...mergeDefaults({ label, status: '', note: '' }, arr[i]), label }));
  const extra = arr.slice(labels.length).flatMap((item) => {
    const row = mergeDefaults({ label: '', status: '', note: '' }, item);
    return row.label || row.status || row.note ? [row] : [];
  });
  return [...known, ...extra];
}

function normalizeStation(raw: unknown, i: number): SmaStation {
  const base = makeStation(i + 1);
  const s = mergeDefaults(base, raw);
  if (typeof s.id !== 'string' || !s.id) s.id = makeId();
  if (!s.code.trim()) s.code = `TR${i + 1}`;
  s.panelChecklist = normalizeChecks((raw as SmaStation | null)?.panelChecklist ?? s.panelChecklist, PANEL_CHECKLIST);
  s.transformer = mergeDefaults(makeTransformer(), s.transformer);
  s.transformer.checklist = normalizeChecks(s.transformer.checklist, TRANSFORMER_VISUAL_CHECKLIST);
  s.cleaning = normalizeChecks((raw as SmaStation | null)?.cleaning ?? s.cleaning, INVERTER_CLEANING_CHECKLIST);
  s.cells = (Array.isArray(s.cells) ? s.cells : []).map((c) => mergeDefaults(makeCell(), c));
  s.insulation = normalizeInsulationTable(s.insulation);
  s.insulationEnabled = s.insulationEnabled !== false;
  return s;
}

export function normalizeSma(raw: unknown): SmaMaintenanceReport {
  const d = mergeDefaults(createEmpty(), raw);
  const rawStations = (raw && typeof raw === 'object' && Array.isArray((raw as SmaMaintenanceReport).stations))
    ? (raw as SmaMaintenanceReport).stations : d.stations;
  d.stations = (Array.isArray(rawStations) ? rawStations : []).map(normalizeStation);
  if (!d.stations.length) d.stations = [makeStation(1)];
  d.safetyChecklist = normalizeChecks(
    raw && typeof raw === 'object' ? (raw as SmaMaintenanceReport).safetyChecklist : d.safetyChecklist,
    HV_SAFETY_CHECKLIST,
  );
  return d;
}

/* ------------------------------ פעולות ------------------------------ */

export function stationCode(s: SmaStation, index: number): string {
  return s.code.trim() || `TR${index + 1}`;
}

export function inverterBrandOf(data: ReportData): string {
  return String(data.settings.inverterBrand ?? '').trim() || 'SMA';
}

export function cleaningTitle(brand: string): string {
  return `ניקיון ממיר ${brand.trim() || 'SMA'}`;
}

export function markUncheckedOk(items: CheckItem[]): CheckItem[] {
  return items.map((it) => (it.status ? it : { ...it, status: 'ok' }));
}

export function addStation(d: SmaMaintenanceReport): SmaMaintenanceReport {
  return { ...d, stations: [...d.stations, makeStation(d.stations.length + 1)] };
}

export function duplicateStation(d: SmaMaintenanceReport, id: string): SmaMaintenanceReport {
  const idx = d.stations.findIndex((s) => s.id === id);
  if (idx < 0) return d;
  const clone: SmaStation = { ...structuredClone(d.stations[idx]), id: makeId(), code: `TR${d.stations.length + 1}` };
  clone.transformer = { ...clone.transformer, serialNo: '' };
  const stations = [...d.stations];
  stations.splice(idx + 1, 0, clone);
  return { ...d, stations };
}

/** אסור למחוק את התחנה האחרונה. null = נחסם. */
export function removeStation(d: SmaMaintenanceReport, id: string): SmaMaintenanceReport | null {
  if (d.stations.length <= 1) return null;
  return { ...d, stations: d.stations.filter((s) => s.id !== id) };
}

export function cellHasData(c: SmaCell): boolean {
  return Boolean(c.cellType || c.cellName || c.manufacturer || c.serialNo || c.model || c.groundingType);
}

export function collectSmaDefects(d: SmaMaintenanceReport): Finding[] {
  const fromList = (where: string, items: CheckItem[]): Finding[] => items.flatMap((it) => (
    it.status === 'bad' ? [{ where, text: it.note.trim() ? `${it.label} — ${it.note.trim()}` : (it.label || 'פריט') }] : []
  ));
  return [
    ...d.stations.flatMap((st, i) => {
      const code = stationCode(st, i);
      return [
        ...fromList(`לוח ${code}`, st.panelChecklist),
        ...fromList(`שנאי ${code}`, st.transformer.checklist),
        ...fromList(`ניקיון ממיר ${code}`, st.cleaning),
        ...(st.insulationEnabled ? insulationFindings(st.insulation, `שנאי ${code}`) : []),
      ];
    }),
    ...fromList('ציוד בטיחות למתח גבוה', d.safetyChecklist),
  ];
}

/** מוסיף ליקויים להערות הדוח (סעיף "הערות"), בלי כפילויות. */
export function appendDefectsToNotes(data: ReportData, defects: Finding[]): void {
  const notes = (Array.isArray(data.notes) ? data.notes : []).map((n) => String(n ?? ''));
  const existing = new Set(notes.map((n) => n.trim()).filter(Boolean));
  const fresh = defects.map((f) => `${f.where}: ${f.text}`).filter((t) => !existing.has(t));
  const kept = notes.filter((n) => n.trim());
  data.notes = [...kept, ...fresh];
  if (!data.notes.length) data.notes = [''];
}

/* ------------------------------ פלט ------------------------------ */

const measure = (v: string, unit: string) => (v ? `${v} ${unit || ''}`.trim() : '');

const kv = (caption: string, pairs: Array<[string, string]>): Block | null => {
  const rows = pairs.filter(([, v]) => v && v.trim()).map(([label, value]) => ({ label, value }));
  return rows.length ? { kind: 'fields', caption, rows } : null;
};

function resultText(it: CheckItem | undefined): string {
  if (!it) return '';
  const st = SMA_STATUS_PRINT[it.status] ?? it.status;
  return [st, it.note.trim()].filter(Boolean).join(' — ');
}

/** טבלת שני טורים כמו בדוח: פירוט | תוצאה | פירוט | תוצאה. פריט בלי סטטוס לא ממלא תא, אבל נשאר בטור שלו. */
export function checklistTable(items: CheckItem[], caption: string): Block | null {
  const rows: string[][] = [];
  for (let i = 0; i < items.length; i += 2) {
    const a = items[i];
    const b = items[i + 1];
    const aOn = !!(a && (a.status || a.note.trim()));
    const bOn = !!(b && (b.status || b.note.trim()));
    if (!aOn && !bOn) continue;
    rows.push([aOn ? a.label : '', aOn ? resultText(a) : '', bOn ? (b?.label ?? '') : '', bOn ? resultText(b) : '']);
  }
  if (!rows.length) return null;
  return { kind: 'table', caption, columns: ['פירוט הבדיקה', 'תוצאה', 'פירוט הבדיקה', 'תוצאה'], rows };
}

function answered(items: CheckItem[]): boolean {
  return items.some((it) => it.status || it.note.trim());
}

function cellBlock(c: SmaCell, index: number): Block {
  const title = `תא ${c.cellNumber || index + 1}${c.cellName ? ' — ' + c.cellName : ''}`;
  const blocks: Block[] = [];
  const fields = kv('', [
    ['סוג תא', c.cellType],
    ['שם התא', c.cellName],
    ['מספר תא', c.cellNumber],
    ['יצרן', c.manufacturer],
    ['דגם', c.model],
    ['מספר סידורי', c.serialNo],
    ['שנת ייצור', c.yearOfManufacture],
    ['מתח נקוב', measure(c.ratedVoltage, c.ratedVoltageUnit)],
    ['זרם נקוב', measure(c.ratedCurrent, c.ratedCurrentUnit)],
    ['כושר ניתוק', measure(c.breakingCapacity, c.breakingCapacityUnit)],
    ['סוג בידוד', c.insulationType],
    ['סוג מפסק', c.breakerType],
    ['סוג מנתק', c.disconnectorType],
    ['סוג הארקה', c.groundingType],
  ]);
  if (fields) blocks.push(fields);
  if (c.notes.trim()) blocks.push({ kind: 'paragraph', text: c.notes.trim() });
  return { kind: 'facility', title, subtitle: [c.cellType, c.manufacturer].filter(Boolean).join(' · ') || undefined, blocks };
}

function transformerBlocks(st: SmaStation): Block[] {
  const t = st.transformer;
  const blocks: Block[] = [];
  const fields = kv('', [
    ['תוצרת', t.manufacturer],
    ['מס\' יצרן', t.serialNo],
    ['שנת ייצור', t.yearOfManufacture],
    ['הספק (kVA)', t.powerKVA],
    ['מתח נומינלי (kV)', t.nominalVoltage],
    ['מתח קצר (%)', t.shortCircuitVoltagePercent],
    ['סדר חיבורים', t.connectionGroup],
    ['סוג', t.type],
    ['דרגה', t.grade],
  ]);
  if (fields) blocks.push(fields);
  const visual = checklistTable(t.checklist, '');
  if (visual) blocks.push(visual);
  if (t.notes.trim()) blocks.push({ kind: 'paragraph', text: t.notes.trim() });
  return blocks;
}

function transformerHasPrintable(st: SmaStation): boolean {
  const t = st.transformer;
  return Boolean(
    t.manufacturer || t.serialNo || t.yearOfManufacture || t.powerKVA || t.nominalVoltage
    || t.shortCircuitVoltagePercent || t.connectionGroup || t.type || t.grade || t.notes.trim()
    || answered(t.checklist),
  );
}

function hasPhotos(data: ReportData): boolean {
  const raw = data.generalPhotos;
  if (!Array.isArray(raw)) return false;
  return raw.some((p) => p && typeof p === 'object' && (String((p as { dataUrl?: string }).dataUrl || '') || String((p as { cloudPath?: string }).cloudPath || '')));
}

function buildStationSections(d: SmaMaintenanceReport, data: ReportData): DocumentSection[] {
  const brand = inverterBrandOf(data);
  const sections: DocumentSection[] = [];
  d.stations.forEach((st, i) => {
    const code = stationCode(st, i);
    const name = st.stationName.trim();
    const tag = name ? `${code} — ${name}` : code;
    const panel = checklistTable(st.panelChecklist, '');
    if (panel) sections.push({ id: `sma-${st.id}-panel`, zone: 'content', title: `בדיקה ויזואלית — לוח — ${tag}`, icon: '🔍', blocks: [panel] });
    const cells = st.cells.filter(cellHasData);
    if (cells.length) {
      sections.push({
        id: `sma-${st.id}-cells`, zone: 'content', title: `תאי מתח גבוה — ${tag}`, icon: '🔌',
        blocks: cells.map((c, ci) => cellBlock(c, ci)),
      });
    }
    if (transformerHasPrintable(st)) {
      sections.push({ id: `sma-${st.id}-tr`, zone: 'content', title: `שנאי — ${code}`, icon: '🔋', blocks: transformerBlocks(st) });
    }
    const clean = checklistTable(st.cleaning, '');
    if (clean) sections.push({ id: `sma-${st.id}-clean`, zone: 'content', title: `${cleaningTitle(brand)} — ${tag}`, icon: '🧹', blocks: [clean] });
    if (st.insulationEnabled) {
      const ins = insulationBlock(st.insulation, 'בדיקת בידוד — שנאי');
      if (ins) sections.push({ id: `sma-${st.id}-ins`, zone: 'content', title: `בדיקת בידוד — שנאי — ${code}`, icon: '⚡', blocks: [ins] });
    }
    if (st.notes.trim()) {
      sections.push({ id: `sma-${st.id}-notes`, zone: 'content', title: `הערות תחנה — ${tag}`, icon: '📝', blocks: [{ kind: 'paragraph', text: st.notes.trim() }] });
    }
  });
  const safety = checklistTable(d.safetyChecklist, '');
  if (safety) sections.push({ id: 'sma-safety', zone: 'content', title: 'ציוד בטיחות למתח גבוה', icon: '🦺', blocks: [safety] });
  return sections;
}

function tocSection(entries: string[]): DocumentSection {
  return {
    id: 'sma-toc', zone: 'content', title: 'תוכן עניינים', icon: '📑',
    blocks: [{ kind: 'table', columns: ['נושא'], rows: entries.map((t) => [t]) }],
  };
}

export const smaService = defineReportService<SmaMaintenanceReport>('SMA', {
  legacyKey: LEGACY_KEY,
  // טבלת ריכוז ליקויים אוטומטית — גם לליקויי ממסר (הבדיקה הקיימת על SMA מסתמכת על זה)
  showFindingsTable: true,
  isSkeleton: false,
  createEmpty,
  normalize: normalizeSma,
  validate: (d, data): ValidationIssue[] => {
    const issues: ValidationIssue[] = [];
    d.stations.forEach((st, i) => {
      const code = stationCode(st, i);
      const p = `stations.${i}`;
      if (!answered(st.panelChecklist)) issues.push({ path: `${p}.panelChecklist`, message: `${code}: הבדיקה הוויזואלית של הלוח ריקה`, severity: 'warning' });
      if (!answered(st.cleaning)) issues.push({ path: `${p}.cleaning`, message: `${code}: ניקיון הממיר לא סומן`, severity: 'warning' });
      if (!st.transformer.manufacturer && !st.transformer.serialNo) issues.push({ path: `${p}.transformer.serialNo`, message: `${code}: חסרים תוצרת או מס' יצרן של השנאי`, severity: 'warning' });
      const lists: Array<[string, CheckItem[]]> = [
        ['הלוח', st.panelChecklist],
        ['השנאי', st.transformer.checklist],
        ['ניקיון הממיר', st.cleaning],
      ];
      for (const [where, items] of lists) {
        items.forEach((it, ci) => {
          if (it.status === 'bad' && !it.note.trim()) issues.push({ path: `${p}.checklist.${ci}`, message: `${code}: "${it.label}" ב${where} סומן לא תקין בלי הערה`, severity: 'warning' });
        });
      }
      st.cells.forEach((c, ci) => {
        if (!cellHasData(c)) issues.push({ path: `${p}.cells.${ci}`, message: `${code}: תא ${ci + 1} ריק — לא יודפס`, severity: 'warning' });
      });
      if (st.insulationEnabled && !st.insulation.rows.some(rowHasData)) {
        issues.push({ path: `${p}.insulation`, message: `${code}: בדיקת הבידוד ריקה (אפשר לכבות אותה אם אין מדידה, כמו TR3)`, severity: 'warning' });
      }
    });
    d.safetyChecklist.forEach((it, i) => {
      if (it.status === 'bad' && !it.note.trim()) issues.push({ path: `safetyChecklist.${i}`, message: `"${it.label}" בציוד הבטיחות סומן לא תקין בלי הערה`, severity: 'warning' });
    });
    if (!answered(d.safetyChecklist)) issues.push({ path: 'safetyChecklist', message: 'ציוד הבטיחות למתח גבוה לא סומן', severity: 'warning' });
    const approval = readApproval(data);
    if (!approval) issues.push({ path: 'approvalStatus', message: 'לא נבחר "אישור חשמול"', severity: 'error' });
    else if (approval === 'מתקן חשמל מאושר' && collectSmaDefects(d).length) {
      issues.push({ path: 'approvalStatus', message: '"מתקן חשמל מאושר" נבחר אך יש פריטים שסומנו לא תקין', severity: 'warning' });
    }
    return issues;
  },
  buildSections: (d, data): DocumentSection[] => {
    const content = buildStationSections(d, data);
    const defects = collectSmaDefects(d);
    const relayOn = readRelays(data).some(isPrintable);
    const relayDefects = relayFindings(data);
    const notesOn = (Array.isArray(data.notes) ? data.notes : []).some((n) => String(n ?? '').trim());
    const approvalOn = !!readApproval(data);
    const photosOn = hasPhotos(data);
    if (!content.length && !notesOn && !approvalOn && !photosOn && !relayOn && !defects.length) return [];
    const entries = [
      ...content.map((s) => s.title),
      ...(relayOn ? ['ממסרי הגנה'] : []),
      ...(defects.length || relayDefects.length ? ['סיכום ליקויים'] : []),
      ...(notesOn ? ['הערות'] : []),
      ...(approvalOn ? ['אישור'] : []),
      'הערות בודק',
      'חתימה',
      ...(photosOn ? ['תיעוד תמונות'] : []),
    ];
    if (content.length) content[0] = { ...content[0], pageBreakBefore: true };
    return [tocSection(entries), ...content];
  },
  findings: collectSmaDefects,
});

/* ------------------------------ דוח הדגמה לפי ה-PDF ------------------------------ */

function fillOk(labels: readonly string[], patch: Record<number, Partial<CheckItem>> = {}): CheckItem[] {
  return labels.map((label, i) => ({ label, status: 'ok', note: '', ...patch[i] }));
}

function siemensCell(partial: Partial<SmaCell>): SmaCell {
  return {
    ...makeCell(),
    cellNumber: '1', manufacturer: 'Siemens', yearOfManufacture: '2023',
    ratedVoltage: '25', ratedVoltageUnit: 'kV', ratedCurrent: '630', ratedCurrentUnit: 'A',
    breakingCapacity: '20', breakingCapacityUnit: 'kA', insulationType: 'SF6 (GIS)', breakerType: 'SF6',
    disconnectorType: 'מנתק עומס (Load Break)', groundingType: '1x95 cu pvc',
    ...partial,
  };
}

function insulationHv(gigaOhm: string): InsulationTable {
  const t = makeInsulationTable();
  t.testMethod = 'dar';
  t.rows[0] = { ...t.rows[0], r60: gigaOhm, unit: 'GΩ' };
  return t;
}

/** שתי תחנות מלאות בסגנון הדוח (TR1 עם בדיקה ויזואלית לשנאי, TR2 בלי), כדי שהתצוגה תכסה כל סעיף. */
export function sampleSmaTypeData(): SmaMaintenanceReport {
  const tr1 = makeStation(1);
  tr1.code = 'TR1';
  tr1.panelChecklist = fillOk(PANEL_CHECKLIST);
  tr1.cells = [
    siemensCell({ cellType: 'תא כניסה', cellName: 'תא כניסה CB3 4', model: '8DJH-R', serialNo: 'Cv552777-000020/40' }),
    siemensCell({ cellType: 'תא יציאה', cellName: 'תא יציאה ל תא cb1 ב ST2', model: '8DJH-R', serialNo: 'Cv552777-000020/40' }),
    siemensCell({ cellType: 'תא יציאה', cellName: 'הזנה לשנאי TR1', model: '8DJH-L', serialNo: 'Cv552777-000020/40' }),
  ];
  tr1.transformer = {
    ...makeTransformer(),
    manufacturer: 'SBG', serialNo: '2825112', yearOfManufacture: '2023', powerKVA: '4000',
    nominalVoltage: '22kV/600V', shortCircuitVoltagePercent: '6.4', connectionGroup: 'Dy11', type: 'שמן', grade: '2',
    checklist: fillOk(TRANSFORMER_VISUAL_CHECKLIST),
  };
  tr1.cleaning = fillOk(INVERTER_CLEANING_CHECKLIST);
  tr1.insulation = insulationHv('1.6');

  const tr2 = makeStation(2);
  tr2.code = 'TR2';
  tr2.panelChecklist = fillOk(PANEL_CHECKLIST);
  tr2.cells = [
    siemensCell({ cellType: 'תא כניסה', cellName: 'תא כניסה מ CB2 ב ST1', cellNumber: '1', model: '8DJH-R', serialNo: 'CV552777-000020/001', ratedCurrent: '' }),
    siemensCell({ cellType: 'תא יציאה', cellName: 'תא יציאה ל תא CB1 ב ST3', cellNumber: '2', model: '8DJH-R', serialNo: 'CV552777-000020/001' }),
    siemensCell({ cellType: 'תא יציאה', cellName: 'שנאי TR2', cellNumber: '3', model: '8DJH-L', serialNo: 'CV552777-000020/001' }),
  ];
  tr2.transformer = {
    ...makeTransformer(),
    manufacturer: 'SBG', serialNo: '2825114', yearOfManufacture: '2023', powerKVA: '4000',
    nominalVoltage: '22kV/600V', shortCircuitVoltagePercent: '6.4', connectionGroup: 'Dy11', type: 'שמן', grade: '2',
    checklist: makeChecks(TRANSFORMER_VISUAL_CHECKLIST),
  };
  tr2.cleaning = fillOk(INVERTER_CLEANING_CHECKLIST);
  tr2.insulation = insulationHv('1.82');

  const safety = fillOk(HV_SAFETY_CHECKLIST, {
    0: { status: 'bad', note: 'נדרש להחליף' },
    8: { status: 'na', note: '' },
  });

  return { stations: [tr1, tr2], safetyChecklist: safety };
}

function photoPlaceholder(label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="100%" height="100%" fill="#e7eef5"/><text x="320" y="190" text-anchor="middle" font-size="28" font-family="Heebo, Arial, sans-serif" fill="#0F2E4D">${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** דוח הדגמה מלא: פרטי השער של ניר יצחק + שתי תחנות + הערות, אישור ותמונות. לא נכתב לענן. */
export function sampleSmaReportData(): ReportData {
  const data: ReportData = {
    meta: {
      ...emptyMeta(),
      reportNumber: 'SMA-1099-09-2026',
      date: '2026-09-10',
      issueDate: '2026-09-10',
      client: 'אלמור אנרגיות מתחדשות',
      attentionTo: 'נתנאל',
      siteName: 'ניר יצחק',
      address: 'קיבוץ ניר יצחק',
      description: 'התבקשתי לבצע טיפול שנתי לאתר סולרי ניר יצחק. הטיפול כולל ניקיון ובדיקות במתח גבוה',
      testInstrumentsSelected: ['SONEL'],
    },
    settings: {
      ...emptySettings(REPORT_TYPES.SMA.nameHe),
      inverterBrand: 'SMA',
      engineerName: 'משה נעמן',
      licenseType: 'בודק חשמל סוג 3',
      testerLicenseNo: '995339',
      engineerLicenseNo: '118686',
      companyName: 'שקד הנדסת חשמל בע"מ',
      phone: '0542986000',
      officePhone: '0543435052',
      email: 'shked@shked.co.il',
      companyAddress: 'נועם דרקי 9 אשקלון',
    },
    notes: [
      'שנאי TR3 — קיים קורוזיה בפלטה של PT100',
      'ממיר ST1 — קיים חוסר של גז SF6. נדרש לעקוב ולבדוק מול הלוח באחריות',
      'ST5 — חלונית סגירת מנגנון לא תקינה. נדרש לבדוק מול הלוח באחריות',
      'ST5 — חלונית מנגנון היה מכוסה עם מגנט',
      'ממיר ST5 — תא שמור לא לחבר. נדרש לשלט בצורה תקינה',
    ],
    customDeclaration: '',
    showElectricianDeclaration: true,
    electricianDeclarationText: SMA_ELECTRICIAN_DECLARATION,
    approvalStatus: 'מתקן חשמל מאושר',
  };
  writeTypeData(smaService, data, sampleSmaTypeData());
  const p1 = makePhotoEntry(photoPlaceholder('ממיר ST1'), 'st1.svg', 'image/svg+xml');
  p1.title = 'ממיר — ST1';
  p1.notes = ['קיים חוסר של גז SF6 — נדרש לעקוב ולבדוק מול הלוח באחריות'];
  const p2 = makePhotoEntry(photoPlaceholder('ST5'), 'st5.svg', 'image/svg+xml');
  p2.title = 'ST5';
  p2.notes = ['חלונית סגירת מנגנון לא תקינה — נדרש לבדוק מול הלוח באחריות', 'חלונית מנגנון היה מכוסה עם מגנט'];
  writePhotos(data, [p1, p2]);
  return data;
}
