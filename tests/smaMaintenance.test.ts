import { describe, expect, it } from 'vitest';
import { emptyMeta, emptySettings, type ReportData } from '@/core/reportModel';
import { renderReportDocument, validateReport } from '@/services/reports';
import { readTypeData, writeTypeData } from '@/services/reports/ReportTypeService';
import { EMPTY_PROFILE, profileWithReportFallback } from '@/services/companySettingsService';
import {
  HV_SAFETY_CHECKLIST, INVERTER_CLEANING_CHECKLIST, LEGACY_KEY, PANEL_CHECKLIST, SMA_ELECTRICIAN_DECLARATION,
  TRANSFORMER_VISUAL_CHECKLIST, addStation, appendDefectsToNotes, collectSmaDefects, duplicateStation, normalizeSma,
  removeStation, sampleSmaReportData, sampleSmaTypeData, smaService,
} from '@/services/reports/types/sma.service';
import { createNewReport, type SyncDeps } from '@/services/reportSyncService';
import { memoryStore } from './memoryStore';

function shell(typeData = smaService.createEmpty()): ReportData {
  const data: ReportData = {
    meta: { ...emptyMeta(), reportNumber: 'SMA-1-09-2026', client: 'לקוח', date: '2026-09-10' },
    settings: emptySettings('טיפול בממירי SMA'),
    notes: [''],
    approvalStatus: 'מתקן חשמל מאושר',
  };
  writeTypeData(smaService, data, typeData);
  return data;
}

describe('SMA — רשימות כמו בדוח המודפס', () => {
  it('לוח 14, שנאי 3, ניקיון ממיר 6, ציוד בטיחות 11 — ובסדר הזוגות', () => {
    expect(PANEL_CHECKLIST).toHaveLength(14);
    expect(PANEL_CHECKLIST.slice(0, 4)).toEqual([
      'בדיקה ויזואלית', 'אטימות של התא', 'בדיקת חיזוק הלוח לקרקע', 'שלמות לחצנים נורות והגנות',
    ]);
    expect(TRANSFORMER_VISUAL_CHECKLIST).toEqual([
      'בדיקה ויזואלית', 'בדיקת חיזוק השנאי לקרקע', 'שלמות לחצנים נורות והגנות',
    ]);
    expect(INVERTER_CLEANING_CHECKLIST).toEqual([
      'ניקיון קבלים', 'ניקיון מפוח פנימי', 'ניקיון סליל שנאי (תחתון)', 'ניקיון שנאי בית ממיר',
      'ניקיון תעלות היברור', 'ניקיון מסננים עליון חיצוני',
    ]);
    expect(HV_SAFETY_CHECKLIST[0]).toBe('כפפות מ"ג');
    expect(HV_SAFETY_CHECKLIST).toContain('בחדר מ"ג קיים סרטוט חד קווי');
    expect(HV_SAFETY_CHECKLIST).toHaveLength(11);
  });
});

describe('SMA — נרמול ומספר תחנות', () => {
  it('משלים רשימות, שומר שדה לא מוכר, ורשימה ריקה חוזרת לתחנה אחת', () => {
    const n = normalizeSma({
      someOldField: 7,
      stations: [{ code: 'TR9', future: 1, panelChecklist: [{ status: 'ok', note: 'נשמר' }] }],
    });
    expect(n.someOldField).toBe(7);
    expect(n.stations).toHaveLength(1);
    expect(n.stations[0].code).toBe('TR9');
    expect(n.stations[0].future).toBe(1);
    expect(n.stations[0].panelChecklist).toHaveLength(PANEL_CHECKLIST.length);
    expect(n.stations[0].panelChecklist[0]).toMatchObject({ label: 'בדיקה ויזואלית', status: 'ok', note: 'נשמר' });
    expect(n.stations[0].cleaning).toHaveLength(INVERTER_CLEANING_CHECKLIST.length);
    expect(n.safetyChecklist).toHaveLength(HV_SAFETY_CHECKLIST.length);
    expect(normalizeSma(undefined).stations).toHaveLength(1);
    expect(normalizeSma({ stations: [] }).stations).toHaveLength(1);
  });

  it('הוספה, שכפול (בלי מספר יצרן) ומחיקה — אי אפשר למחוק את האחרונה', () => {
    let d = sampleSmaTypeData();
    d = addStation(addStation(addStation(d)));
    expect(d.stations.map((s) => s.code)).toEqual(['TR1', 'TR2', 'TR3', 'TR4', 'TR5']);
    const dup = duplicateStation(d, d.stations[0].id);
    expect(dup.stations[1].id).not.toBe(dup.stations[0].id);
    expect(dup.stations[1].transformer.serialNo).toBe('');
    expect(dup.stations[0].transformer.serialNo).toBe('2825112');
    expect(dup.stations[1].panelChecklist[0].status).toBe('ok');
    const removed = removeStation(dup, dup.stations[1].id);
    expect(removed!.stations.map((s) => s.code)).toEqual(['TR1', 'TR2', 'TR3', 'TR4', 'TR5']);
    expect(removeStation({ ...d, stations: [d.stations[0]] }, d.stations[0].id)).toBeNull();
  });
});

describe('SMA — המסמך מול מבנה ה-PDF', () => {
  const data = sampleSmaReportData();
  const doc = renderReportDocument(data, null, { company: profileWithReportFallback(EMPTY_PROFILE, data.settings) });

  it('נכתב למפתח smaMaintenanceReport ולא ל-typeData', () => {
    expect(data[LEGACY_KEY]).toBeTruthy();
    expect(data.typeData).toBeUndefined();
    expect(readTypeData(smaService, data).stations).toHaveLength(2);
  });

  it('עמוד שער: כותרת, מספר, סדר שדות, SONEL והצהרת החשמלאי', () => {
    expect(doc.cover?.title).toBe('טיפול בממירי SMA');
    expect(doc.cover?.reportNumber).toBe('SMA-1099-09-2026');
    expect(doc.cover?.rows.map((r) => r.label)).toEqual([
      'מזמין הבדיקה', 'לידי (איש קשר)', 'שם המתקן', 'מיקום המתקן', 'תאריך הבדיקה', 'תאריך הפקת הדוח',
      'מבצע הבדיקה', 'מספר רישיון בודק', 'מספר רישיון מהנדס', 'תיאור המתקן/העבודה', 'מכשירי בדיקה',
    ]);
    expect(doc.cover?.rows.find((r) => r.label === 'מזמין הבדיקה')?.value).toBe('אלמור אנרגיות מתחדשות');
    expect(doc.cover?.rows.find((r) => r.label === 'שם המתקן')?.value).toBe('ניר יצחק');
    expect(doc.cover?.rows.find((r) => r.label === 'מבצע הבדיקה')?.value).toContain('משה נעמן');
    expect(doc.cover?.rows.find((r) => r.label === 'מכשירי בדיקה')?.value).toContain('SONEL');
    expect(doc.cover?.electrician?.text).toBe(SMA_ELECTRICIAN_DECLARATION);
    expect(doc.footerText).toContain('שקד הנדסת חשמל בע"מ');
  });

  it('תוכן עניינים ואז כל סעיף תחנה, בלי בידוד כשהוא כבוי', () => {
    const titles = doc.sections.map((s) => s.title);
    expect(titles[0]).toBe('תוכן עניינים');
    expect(titles).toEqual(expect.arrayContaining([
      'בדיקה ויזואלית — לוח — TR1',
      'תאי מתח גבוה — TR1',
      'שנאי — TR1',
      'ניקיון ממיר SMA — TR1',
      'בדיקת בידוד — שנאי — TR1',
      'בדיקה ויזואלית — לוח — TR2',
      'שנאי — TR2',
      'ניקיון ממיר SMA — TR2',
      'בדיקת בידוד — שנאי — TR2',
      'ציוד בטיחות למתח גבוה',
    ]));
    const toc = doc.sections[0].blocks[0] as { rows: string[][] };
    expect(toc.rows.map((r) => r[0])).toContain('הערות');
    expect(toc.rows.map((r) => r[0])).toContain('אישור');
    expect(toc.rows.map((r) => r[0])).toContain('תיעוד תמונות');
    expect(doc.sections[1].pageBreakBefore).toBe(true);
  });

  it('טבלת הלוח בזוגות, תא מ"ג לפי סדר השדות, ובידוד HV ב-GΩ', () => {
    const panel = doc.sections.find((s) => s.title === 'בדיקה ויזואלית — לוח — TR1')!;
    const table = panel.blocks[0] as { columns: string[]; rows: string[][] };
    expect(table.columns).toEqual(['פירוט הבדיקה', 'תוצאה', 'פירוט הבדיקה', 'תוצאה']);
    expect(table.rows[0]).toEqual(['בדיקה ויזואלית', 'תקין ✓', 'אטימות של התא', 'תקין ✓']);
    expect(table.rows).toHaveLength(7);

    const cells = doc.sections.find((s) => s.title === 'תאי מתח גבוה — TR1')!;
    const first = cells.blocks[0] as { title: string; blocks: Array<{ rows: Array<{ label: string; value: string }> }> };
    expect(first.title).toContain('תא כניסה CB3 4');
    expect(first.blocks[0].rows.map((r) => r.label).slice(0, 6)).toEqual(['סוג תא', 'שם התא', 'מספר תא', 'יצרן', 'דגם', 'מספר סידורי']);
    expect(first.blocks[0].rows.find((r) => r.label === 'סוג הארקה')?.value).toBe('1x95 cu pvc');

    const tr = doc.sections.find((s) => s.title === 'שנאי — TR1')!;
    const nameplate = tr.blocks[0] as { rows: Array<{ label: string; value: string }> };
    expect(nameplate.rows.map((r) => r.label)).toEqual([
      'תוצרת', 'מס\' יצרן', 'שנת ייצור', 'הספק (kVA)', 'מתח נומינלי (kV)', 'מתח קצר (%)', 'סדר חיבורים', 'סוג', 'דרגה',
    ]);
    expect(nameplate.rows.find((r) => r.label === 'מס\' יצרן')?.value).toBe('2825112');
    expect(JSON.stringify(tr)).toContain('בדיקת חיזוק השנאי לקרקע');
    expect(JSON.stringify(doc.sections.find((s) => s.title === 'שנאי — TR2'))).not.toContain('בדיקת חיזוק השנאי לקרקע');

    const ins = doc.sections.find((s) => s.title === 'בדיקת בידוד — שנאי — TR1')!;
    const iTable = ins.blocks[0] as { columns: string[]; rows: string[][] };
    expect(iTable.columns).toContain('DAR');
    expect(iTable.rows).toHaveLength(1);
    expect(iTable.rows[0][0]).toBe('מתח גבוה להארקה');
    expect(iTable.rows[0].some((c) => c.includes('1.6') && c.includes('GΩ'))).toBe(true);
  });

  it('כיבוי בידוד משמיט את הסעיף; כפפות לא תקינות נכנסות לליקויים', () => {
    const edited = sampleSmaTypeData();
    edited.stations[1].insulationEnabled = false;
    const local = shell(edited);
    const rendered = renderReportDocument(local, null);
    expect(rendered.sections.some((s) => s.title.includes('בידוד') && s.title.includes('TR2'))).toBe(false);
    expect(rendered.sections.some((s) => s.title.includes('בידוד') && s.title.includes('TR1'))).toBe(true);

    const defects = collectSmaDefects(edited);
    expect(defects).toEqual([expect.objectContaining({ where: 'ציוד בטיחות למתח גבוה', text: 'כפפות מ"ג — נדרש להחליף' })]);
    expect(JSON.stringify(doc.sections.find((s) => s.title === 'ציוד בטיחות למתח גבוה'))).toContain('לא רלוונטי');
    expect(JSON.stringify(doc.sections.find((s) => s.id === 'findings'))).toContain('כפפות');
  });

  it('יצרן אחר משנה את כותרת הדוח ואת סעיף הניקיון', () => {
    const h = sampleSmaReportData();
    h.settings.inverterBrand = 'Huawei';
    const rendered = renderReportDocument(h, null);
    expect(rendered.cover?.title).toBe('טיפול בממירי Huawei');
    expect(rendered.sections.some((s) => s.title.startsWith('ניקיון ממיר Huawei'))).toBe(true);
  });

  it('הערות, אישור ותמונות בסוף; העתקת ליקויים לא מכפילה', () => {
    expect(doc.sections.find((s) => s.zone === 'notes')).toBeTruthy();
    expect(doc.sections.find((s) => s.id === 'approval')).toBeTruthy();
    expect(doc.sections.find((s) => s.id === 'photos')?.title).toBe('תיעוד תמונות');
    const notes = shell();
    appendDefectsToNotes(notes, collectSmaDefects(sampleSmaTypeData()));
    appendDefectsToNotes(notes, collectSmaDefects(sampleSmaTypeData()));
    expect(notes.notes.filter((n) => n.includes('כפפות'))).toHaveLength(1);
  });
});

describe('SMA — בדיקות לפני הפקה ודוח חדש', () => {
  it('"לא תקין" בלי הערה ואישור חסר — אזהרה ושגיאה', () => {
    const t = smaService.createEmpty();
    t.safetyChecklist[0].status = 'bad';
    const data = shell(t);
    data.approvalStatus = '';
    const issues = validateReport(data);
    expect(issues.some((i) => i.path.startsWith('safetyChecklist') && i.message.includes('כפפות'))).toBe(true);
    expect(issues.some((i) => i.path === 'approvalStatus' && i.severity === 'error')).toBe(true);
  });

  it('דוח חדש: נוסח ההצהרה ויצרן SMA, תחנה אחת ריקה', async () => {
    const m = memoryStore();
    const deps: SyncDeps = { store: m.store, deviceId: 'dev', userId: 'u', localCounter: { get: () => 1098, set: () => {} } };
    const r = await createNewReport(deps, 'SMA');
    expect(r.meta.reportNumber.startsWith('SMA-')).toBe(true);
    expect(r.electricianDeclarationText).toBe(SMA_ELECTRICIAN_DECLARATION);
    expect(r.settings.inverterBrand).toBe('SMA');
    expect(readTypeData(smaService, r).stations).toHaveLength(1);
    expect(r.typeData).toBeUndefined();
  });
});
