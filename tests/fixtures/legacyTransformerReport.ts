/**
 * report_data במבנה שהאפליקציה הישנה שומרת לדוח שנאי (state מלא, מקוצר לשדות הרלוונטיים).
 * כולל: שנאי "ישן" בלי שדה Uk% ועם checklist קצר, שדות לא מוכרים, ממסרי הגנה,
 * ממצאים עם חור במספור, ומפתחות של סוגי דוח אחרים — כולם חייבים לשרוד שמירה מהאפליקציה החדשה.
 */
import { TI_INSULATION_TESTS } from '@/services/reports/types/transformerInspection.service';

export function legacyTransformerReportData() {
  return {
    meta: {
      siteName: 'תחנת משנה צפון', address: 'אזור תעשייה, חיפה', client: 'לקוח בע"מ', clientAddress: '', date: '2026-10-01',
      issueDate: '', description: 'בדיקה תקופתית לשנאים', attentionTo: 'מנהל אחזקה', project: '', reportNumber: 'TR-1203-10-2026',
      testInstrumentsSelected: ['מכשיר משולב MI3155'], fireberryMeetingId: 'fb-123', reportRevision: '1',
    },
    settings: {
      formTypeName: 'דוח בדיקת שנאי מתח גבוה', cloudReportId: 'rep-1', savedByDevice: 'dev_old', cloudInsertPending: false,
      engineerName: 'בודק', logo: 'data:image/png;base64,AAAA', maxDrafts: 5,
    },
    notes: ['יש להחליף שלט אזהרה', ''],
    declarationsOn: [true, true, true, true, true],
    customDeclaration: '',
    showElectricianDeclaration: false,
    generalPhotos: [{ id: 'ph1', cloudPath: 'rep-1/x.jpg', caption: 'חזית' }],
    panels: { p1: { name: 'לא קשור' } },
    protectionRelays: [{ id: 'rel_1', model: 'ABB REJ603', location: 'תא 3', info: { serial: 'SN9' }, settings: { Igt: '1.2' }, dips: { S1: '10100000' }, extra: { tripTest: 'תקין' }, notes: '', collapsed: false }],
    transformerInspectionReport: {
      testInstrumentsText: 'מגר 5kV', accompaniedBy: 'חשמלאי האתר',
      transformers: [
        {
          id: 'panel_abc1', num: 1, serialNo: 'S-100', model: 'TMC 1000', manufacturer: 'TMC', powerKVA: '1000',
          primaryVoltageKV: '22 kV', secondaryVoltageV: '400 V', connectionGroup: 'Dyn11', yearOfManufacture: '2015', transformerType: 'יצוק',
          // אין shortCircuitVoltagePercent (דוח ישן)
          groundingMethod: { parallelConductors: '2', crossSection: '95', conductorType: 'נחושת' },
          groundingProtection: { parallelConductors: '1', crossSection: '50' }, // חסר conductorType
          checklistEnabled: true,
          checklist: Array.from({ length: 20 }, (_, i) => ({ status: i === 2 ? 'X' : 'V', notes: i === 2 ? 'שלט דהוי' : '' })),
          insulationEnabled: true,
          insulationTests: TI_INSULATION_TESTS.map((t, i) => ({ key: t.key, enabled: i < 2, status: i < 2 ? 'V' : '', value: i < 2 ? '2500' : '' })),
          sectionNotes: '',
          someFutureField: 'נשמר', // שדה שהחדשה לא מכירה
        },
      ],
      summaryItems: [{ number: 1, text: 'שלט אזהרה דהוי' }, { number: 3, text: 'לנקות את חדר השנאים' }],
      conclusion: { status: 'לא תקין', freeText: '' },
    },
  };
}
