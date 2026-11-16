/**
 * TRANSFORMER_INSPECTION — דוח בדיקת שנאי מתח גבוה (קידומת TR, תיקיית "בדיקות מתח גבוה").
 * 22 פריטי checklist, 5 בדיקות בידוד ורשימות הבחירה — הועתקו מהאפליקציה הישנה.
 * סעיפים: 01 פרטי המתקן, 02 שנאים, 03 ממצאים מסכמים, 04 מסקנה; הצהרות מ-05.
 */
import { defineReportService, mergeDefaults } from '../ReportTypeService';
import { checklistBlock, checklistFindings, fieldsBlock, makeChecklist, measurementTable, newId, type ChecklistItem, type MeasurementRow } from '../helpers';

export const TI_CHECKLIST = [
  'מרחקים תקינים מסביב לשנאי', 'ניקיון השנאי',
  'שילוט אזהרה על כלוב השנאי - זהירות, אין להיכנס לפני הפסקה וקיצור מקורות הזנה',
  'מצב בידודים (Bushings) - ללא סדקים או נזק', 'קיום ותקינות הארקת השנאי', 'קיום גישה בטוחה לתחזוקה',
  'תקינות מערכת איוורור/קירור', 'קיום ותקינות מערכת גילוי אש', 'קיום ותקינות תאורת חירום בחדר שנאים',
  'פתיחת דלת כלפי חוץ', 'קיום ותקינות הארקת שירותים מתכתיים בסביבת השנאי', 'תקינות לחצן ניתוק בחירום',
  'קיום ותקינות מאצרת שמן', 'התאמת השנאי לתכניות', 'התאמת השילוט של המבטח המזין לתכניות',
  'תקינות פעילות ממסר הגנת טמפרטורה לקבלת התראה', 'תקינות פעילות ממסר הגנת טמפרטורה לקבלת הפסקה',
  'קבלת התראה במערכת הבקרה מיחידת DGPT', 'קבלת הפסקה מיחידת ה-DGPT', 'זיהוי בהתאם לשילוט וליעוד',
  'זיהוי ובדיקת הצלבות', 'תקינות דלתות ומנעולי חדר שנאים',
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
} as const;

export interface TransformerUnit {
  id: string;
  name: string;
  manufacturer: string; serialNumber: string; powerKva: string; type: string;
  primaryVoltage: string; secondaryVoltage: string; connectionGroup: string; year: string;
  checklist: ChecklistItem[];
  insulation: MeasurementRow[];
  notes: string;
}

export interface TransformerInspectionData {
  transformers: TransformerUnit[];
  summaryFindings: string;
  conclusion: string;
}

export function makeTransformerUnit(n = 1): TransformerUnit {
  return {
    id: newId(), name: `שנאי ${n}`, manufacturer: '', serialNumber: '', powerKva: '', type: '',
    primaryVoltage: '', secondaryVoltage: '400 V', connectionGroup: '', year: '',
    checklist: makeChecklist(TI_CHECKLIST),
    insulation: TI_INSULATION_TESTS.map((t) => ({ label: t.label, value: '', unit: 'GΩ', pass: null })),
    notes: '',
  };
}

const createEmpty = (): TransformerInspectionData => ({ transformers: [makeTransformerUnit(1)], summaryFindings: '', conclusion: '' });

export const transformerInspectionService = defineReportService<TransformerInspectionData>('TRANSFORMER_INSPECTION', {
  createEmpty,
  normalize: (raw) => {
    const d = mergeDefaults(createEmpty(), raw);
    if (!d.transformers.length) d.transformers = [makeTransformerUnit(1)];
    return d;
  },
  validate: (d) => d.transformers.flatMap((t, i) => [
    ...(!t.primaryVoltage ? [{ path: `transformers.${i}.primaryVoltage`, message: `${t.name}: חסר מתח ראשוני`, severity: 'warning' as const }] : []),
    ...(t.checklist.some((c) => c.status === 'pending') ? [{ path: `transformers.${i}.checklist`, message: `${t.name}: יש פריטים שטרם נבדקו`, severity: 'warning' as const }] : []),
  ]),
  buildSections: (d) => [
    {
      id: 'transformers', zone: 'content', title: 'שנאים', icon: '🔋',
      blocks: d.transformers.map((t) => ({
        kind: 'facility' as const, title: t.name, subtitle: [t.manufacturer, t.powerKva && `${t.powerKva} kVA`].filter(Boolean).join(' · '),
        blocks: [
          fieldsBlock([['יצרן', t.manufacturer], ['מס׳ סידורי', t.serialNumber], ['הספק', t.powerKva && `${t.powerKva} kVA`], ['סוג', t.type],
            ['מתח ראשוני', t.primaryVoltage], ['מתח משני', t.secondaryVoltage], ['קבוצת חיבור', t.connectionGroup], ['שנת ייצור', t.year]]),
          checklistBlock(t.checklist),
          measurementTable('בדיקות בידוד', t.insulation),
          ...(t.notes ? [{ kind: 'paragraph' as const, text: t.notes }] : []),
        ],
      })),
    },
    ...(d.summaryFindings ? [{ id: 'ti-findings', zone: 'content' as const, title: 'ממצאים מסכמים', blocks: [{ kind: 'paragraph' as const, text: d.summaryFindings }] }] : []),
    ...(d.conclusion ? [{ id: 'ti-conclusion', zone: 'content' as const, title: 'מסקנה', blocks: [{ kind: 'paragraph' as const, text: d.conclusion }] }] : []),
  ],
  findings: (d) => d.transformers.flatMap((t) => checklistFindings(t.name, t.checklist)),
});
