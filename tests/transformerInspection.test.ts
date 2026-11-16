import { describe, expect, it } from 'vitest';
import type { ReportData } from '@/core/reportModel';
import { renderReportDocument, validateReport } from '@/services/reports';
import { readTypeData, writeTypeData } from '@/services/reports/ReportTypeService';
import { createNewReport, loadReport, saveReport, type SyncDeps } from '@/services/reportSyncService';
import {
  LEGACY_KEY, TI_CHECKLIST, addTransformer, appendDefectsToSummary, collectDefects, duplicateTransformer, normalizeReport,
  removeTransformer, renumberSummary, transformerInspectionService as svc, type TransformerInspectionReport,
} from '@/services/reports/types/transformerInspection.service';
import { applySyncResult } from '@/features/report-editor/useReportEditor';
import { legacyTransformerReportData } from './fixtures/legacyTransformerReport';
import { legacyLoad, legacyRenderSmoke } from './legacyApp';
import { memoryStore } from './memoryStore';

/** מכניס דוח "ישן" לאחסון בזיכרון, כאילו נשמר מהאפליקציה הישנה. */
async function seedLegacy() {
  const m = memoryStore();
  const legacy = legacyTransformerReportData();
  await m.store.insert({
    id: 'rep-1', project_id: null, client_id: null, report_number: legacy.meta.reportNumber, report_type: 'TRANSFORMER_INSPECTION',
    report_title: legacy.meta.siteName, status: 'draft', inspection_date: legacy.meta.date, report_data: legacy as unknown as ReportData, created_by: 'u0',
  });
  const deps: SyncDeps = { store: m.store, deviceId: 'dev_new', userId: 'u1', localCounter: { get: () => null, set: () => {} } };
  return { m, deps, legacy };
}

const edit = (data: ReportData, fn: (d: TransformerInspectionReport) => void) => {
  const ti = readTypeData(svc, data);
  fn(ti);
  writeTypeData(svc, data, ti);
  data.settings.cloudEditSeq = (data.settings.cloudEditSeq || 0) + 1;
};

describe('שנאי — נרמול נתונים ישנים', () => {
  it('משלים שדות חסרים, מרפד checklist ל-22, ושומר שדות לא מוכרים', () => {
    const ti = normalizeReport(legacyTransformerReportData().transformerInspectionReport);
    const t = ti.transformers[0];
    expect(t.checklist).toHaveLength(22);
    expect(t.checklist[2]).toEqual({ status: 'X', notes: 'שלט דהוי' });
    expect(t.checklist[21]).toEqual({ status: '', notes: '' });
    expect(t.shortCircuitVoltagePercent).toBe('');
    expect(t.groundingProtection.conductorType).toBe('');
    expect(t.groundingProtection.crossSection).toBe('50');
    expect(t.someFutureField).toBe('נשמר');
    expect(ti.accompaniedBy).toBe('חשמלאי האתר');
  });
  it('רשימת שנאים ריקה → שנאי ברירת מחדל (כמו בישן)', () => {
    expect(normalizeReport({ transformers: [] }).transformers).toHaveLength(1);
    expect(normalizeReport(undefined).transformers).toHaveLength(1);
  });
});

describe('שנאי — תאימות דו-כיוונית מול האפליקציה הישנה', () => {
  it('טעינה → עריכה → שמירה: נשמר במפתח הישן, בלי מפתחות חדשים ובלי לגעת בנתונים אחרים', async () => {
    const { m, deps, legacy } = await seedLegacy();
    const loaded = (await loadReport(m.store, 'rep-1'))!;
    edit(loaded.data, (ti) => {
      ti.transformers[0].shortCircuitVoltagePercent = '6';
      ti.transformers[0].checklist[21].status = 'V';
      ti.conclusion.freeText = 'נדרש תיקון';
    });
    loaded.data.notes[1] = 'הערה חדשה';
    expect((await saveReport(deps, loaded.data)).kind).toBe('saved');

    const stored = m.rows.get('rep-1')!.report_data as unknown as Record<string, unknown>;
    // אין מפתחות עליונים חדשים (typeData/summary וכו')
    expect(Object.keys(stored).sort()).toEqual(Object.keys(legacy).sort());
    expect(stored.typeData).toBeUndefined();
    // נתונים שלא נערכו — זהים לגמרי
    expect(stored.protectionRelays).toEqual(legacy.protectionRelays);
    expect(stored.generalPhotos).toEqual(legacy.generalPhotos);
    expect(stored.panels).toEqual(legacy.panels);
    expect((stored.meta as Record<string, unknown>).fireberryMeetingId).toBe('fb-123');
    expect((stored.settings as Record<string, unknown>).logo).toBe(legacy.settings.logo);
    // notes נשאר מערך מחרוזות
    expect(stored.notes).toEqual(['יש להחליף שלט אזהרה', 'הערה חדשה']);
    // העריכות נמצאות במפתח הישן
    const ti = stored[LEGACY_KEY] as ReturnType<typeof normalizeReport>;
    expect(ti.transformers[0].shortCircuitVoltagePercent).toBe('6');
    expect(ti.transformers[0].id).toBe('panel_abc1');
    expect(ti.conclusion.freeText).toBe('נדרש תיקון');
    // מספר הדוח והמזהה לא השתנו
    expect(m.rows.get('rep-1')!.report_number).toBe('TR-1203-10-2026');
  });

  it('דוח שנשמר מהחדשה נטען בישנה: כל העריכות שורדות את mergeDefaults והרינדור לא קורס', async () => {
    const { m, deps } = await seedLegacy();
    const loaded = (await loadReport(m.store, 'rep-1'))!;
    edit(loaded.data, (ti) => {
      Object.assign(ti, duplicateTransformer(ti, ti.transformers[0].id));
      ti.transformers[1].model = 'שנאי 2';
      ti.transformers[1].insulationTests[4] = { key: 'screenEarth', enabled: true, status: 'X', value: '0.5' };
      ti.summaryItems = renumberSummary(ti.summaryItems);
    });
    await saveReport(deps, loaded.data);
    const stored = structuredClone(m.rows.get('rep-1')!.report_data);

    const legacyState = legacyLoad(stored);
    legacyRenderSmoke(legacyState);
    const lti = legacyState.transformerInspectionReport;
    expect(lti.transformers).toHaveLength(2);
    expect(lti.transformers[1].model).toBe('שנאי 2');
    expect(lti.transformers[1].serialNo).toBe(''); // שכפול מאפס מספר סידורי
    expect(lti.transformers[1].insulationTests[4]).toEqual({ key: 'screenEarth', enabled: true, status: 'X', value: '0.5' });
    expect(lti.transformers[0].checklist).toHaveLength(22);
    expect(lti.summaryItems.map((s: { number: number }) => s.number)).toEqual([1, 2]);
    expect(lti.accompaniedBy).toBe('חשמלאי האתר');
    expect(legacyState.protectionRelays[0].dips.S1).toBe('10100000');
  });

  it('דוח חדש מהחדשה: המבנה זהה ל-newState() של הישנה', async () => {
    const m = memoryStore();
    const deps: SyncDeps = { store: m.store, deviceId: 'd', userId: 'u', newId: () => 'new-1', localCounter: { get: () => null, set: () => {} } };
    const r = await createNewReport(deps, 'TRANSFORMER_INSPECTION');
    expect(r.meta.reportNumber).toMatch(/^TR-\d+-\d{2}-\d{4}$/);
    expect(r.notes).toEqual(['']);
    expect(r.typeData).toBeUndefined();
    const ti = r[LEGACY_KEY] as ReturnType<typeof normalizeReport>;
    expect(Object.keys(ti).sort()).toEqual(['accompaniedBy', 'conclusion', 'summaryItems', 'testInstrumentsText', 'transformers']);
    expect(ti.transformers[0].id).toMatch(/^panel_/);
    expect(ti.transformers[0].insulationTests.map((x) => x.key)).toEqual(['hvEarth', 'hvScreen', 'lvEarth', 'hvLv', 'screenEarth']);
    r.meta.client = 'x';
    await saveReport(deps, r);
    legacyRenderSmoke(legacyLoad(structuredClone(m.rows.get('new-1')!.report_data)));
  });

  it('מכשיר אחר (האפליקציה הישנה) שמר בינתיים → קונפליקט, לא דורסים', async () => {
    const { m, deps } = await seedLegacy();
    const loaded = (await loadReport(m.store, 'rep-1'))!;
    m.touchFromOtherDevice('rep-1');
    edit(loaded.data, (ti) => { ti.conclusion.status = 'תקין'; });
    expect(await saveReport(deps, loaded.data)).toEqual({ kind: 'conflict', deleted: false });
    expect((m.rows.get('rep-1')!.report_data[LEGACY_KEY] as { conclusion: { status: string } }).conclusion.status).toBe('לא תקין');
  });
});

describe('שנאי — פעולות עריכה', () => {
  const base = () => normalizeReport(legacyTransformerReportData().transformerInspectionReport);
  it('שכפול: מיד אחרי המקור, id חדש, מספר סידורי ריק, שאר הנתונים זהים', () => {
    const d = duplicateTransformer(base(), 'panel_abc1');
    expect(d.transformers).toHaveLength(2);
    expect(d.transformers[1].id).not.toBe('panel_abc1');
    expect(d.transformers[1].serialNo).toBe('');
    expect(d.transformers[1].model).toBe('TMC 1000');
    d.transformers[1].checklist[0].notes = 'שונה';
    expect(d.transformers[0].checklist[0].notes).toBe(''); // עותק עמוק
  });
  it('מחיקה: אסור למחוק את האחרון', () => {
    expect(removeTransformer(base(), 'panel_abc1')).toBeNull();
    const two = addTransformer(base());
    expect(removeTransformer(two, 'panel_abc1')!.transformers).toHaveLength(1);
  });
  it('העתקת ליקויים לממצאים — בלי כפילויות, עם מספור רציף', () => {
    const d = base();
    expect(collectDefects(d)).toEqual([{ where: 'שנאי מספר 1 — TMC 1000', text: `${TI_CHECKLIST[2]} — שלט דהוי` }]);
    const once = appendDefectsToSummary(d);
    const twice = appendDefectsToSummary(once);
    expect(twice.summaryItems).toHaveLength(3);
    expect(twice.summaryItems.map((s) => s.number)).toEqual([1, 2, 3]);
  });
  it('ליקוי בבידוד נספר רק כשהבדיקה מסומנת', () => {
    const d = base();
    d.transformers[0].insulationTests[3] = { key: 'hvLv', enabled: false, status: 'X', value: '1' };
    expect(collectDefects(d)).toHaveLength(1);
    d.transformers[0].insulationTests[3].enabled = true;
    expect(collectDefects(d)).toHaveLength(2);
  });
});

describe('שנאי — מסמך (תואם buildTransformerInspectionReportBlocks)', () => {
  const doc = () => {
    const data = legacyTransformerReportData() as unknown as ReportData;
    return renderReportDocument(data, '2026-11-16T08:00:00Z');
  };
  it('סדר ומספור: פרטי המתקן, שנאים, ממסרי הגנה (תוכן), ממצאים, מסקנה, ואז הערות והערות בודק', () => {
    const d = doc();
    expect(d.sections.map((s) => [s.number, s.title])).toEqual([
      ['01', 'פרטי המתקן'], ['02', 'שנאים'], ['03', 'ממסרי הגנה'], ['04', 'ממצאים מסכמים'], ['05', 'מסקנה'], ['06', 'הערות'], ['07', 'הערות בודק'], ['08', 'חתימה'],
    ]);
    expect(d.title).toBe('דוח בדיקת שנאי מתח גבוה');
  });
  it('רק פריטים עם סטטוס, רק בדיקות בידוד מסומנות, שדות ריקים לא מודפסים', () => {
    const tr = doc().sections[1].blocks[0] as { kind: string; title: string; blocks: Array<{ kind: string; caption?: string; rows: unknown[] }> };
    expect(tr.title).toBe('שנאי מספר 1 — TMC 1000');
    const visual = tr.blocks.find((b) => b.caption === 'בדיקות ויזואליות')!;
    expect(visual.rows).toHaveLength(20); // 20 עם סטטוס מתוך 22
    expect(visual.rows[2]).toEqual([TI_CHECKLIST[2], 'לא תקין', 'שלט דהוי']);
    const ins = tr.blocks.find((b) => b.caption === 'בדיקת בידוד שנאי')!;
    expect(ins.rows).toEqual([['גבוה - הארקה (HV to Earth)', 'תקין', '2500'], ['גבוה - סיכוך (HV to Screen)', 'תקין', '2500']]);
    const details = tr.blocks.find((b) => b.caption === 'פרטי שנאי')! as unknown as { rows: Array<{ label: string }> };
    expect(details.rows.map((r) => r.label)).not.toContain('דרגת מתח קצר Uk%');
    const gp = tr.blocks.find((b) => b.caption === 'הארקת הגנה')! as unknown as { rows: Array<{ label: string }> };
    expect(gp.rows.map((r) => r.label)).toEqual(['מוליכים במקביל', 'חתך מוליך (ממ"ר)']);
  });
  it('checklist כבוי → לא מודפס; אין טבלת ליקויים אוטומטית', () => {
    const data = legacyTransformerReportData() as unknown as ReportData;
    (data[LEGACY_KEY] as { transformers: Array<{ checklistEnabled: boolean }> }).transformers[0].checklistEnabled = false;
    const d = renderReportDocument(data, null);
    const tr = d.sections[1].blocks[0] as { blocks: Array<{ caption?: string }> };
    expect(tr.blocks.some((b) => b.caption === 'בדיקות ויזואליות')).toBe(false);
    expect(d.sections.some((s) => s.id === 'findings')).toBe(false);
  });
  it('ממצאים: ריקים לא מודפסים; מספר הדוח רק בכותרת', () => {
    const data = legacyTransformerReportData() as unknown as ReportData;
    (data[LEGACY_KEY] as { summaryItems: Array<{ number: number; text: string }> }).summaryItems.push({ number: 4, text: '  ' });
    const d = renderReportDocument(data, null);
    expect((d.sections.find((x) => x.id === 'ti-summary')!.blocks[0] as { items: string[] }).items).toEqual(['שלט אזהרה דהוי', 'לנקות את חדר השנאים']);
    expect(JSON.stringify(d.sections)).not.toContain('TR-1203-10-2026');
    expect(d.reportNumber).toBe('TR-1203-10-2026');
  });
});

describe('שנאי — בדיקות לפני הפקה', () => {
  it('מסקנה חסרה = שגיאה; "תקין" עם ליקויים = אזהרה; לא תקין בלי הערה = אזהרה', () => {
    const data = legacyTransformerReportData() as unknown as ReportData;
    const ti = data[LEGACY_KEY] as { conclusion: { status: string }; transformers: Array<{ checklist: Array<{ status: string; notes: string }> }> };
    ti.conclusion.status = '';
    expect(validateReport(data).find((i) => i.path === 'conclusion.status')?.severity).toBe('error');
    ti.conclusion.status = 'תקין';
    expect(validateReport(data).some((i) => i.message.includes('המסקנה "תקין"'))).toBe(true);
    ti.transformers[0].checklist[5] = { status: 'X', notes: '' };
    expect(validateReport(data).some((i) => i.path === 'transformers.0.checklist.5.notes')).toBe(true);
  });
});

describe('עורך — שמירה בזמן עריכה', () => {
  it('applySyncResult מעדכן שדות סנכרון בלי לאבד עריכה שנעשתה בזמן השמירה', () => {
    const before = legacyTransformerReportData() as unknown as ReportData;
    before.settings.cloudEditSeq = 3;
    const saved = structuredClone(before);
    saved.settings.cloudKnownUpdatedAt = 't9';
    saved.settings.cloudSyncedSeq = 3;
    const current = structuredClone(before);
    current.meta.client = 'נערך בזמן השמירה';
    current.settings.cloudEditSeq = 4;
    const next = applySyncResult(current, saved);
    expect(next.meta.client).toBe('נערך בזמן השמירה');
    expect(next.settings.cloudKnownUpdatedAt).toBe('t9');
    expect(next.settings.cloudEditSeq).toBe(4);
    expect(next.settings.cloudSyncedSeq).toBe(3); // עדיין "יש שינויים" → שמירה אוטומטית נוספת
  });
});
