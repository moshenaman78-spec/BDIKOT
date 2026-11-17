import { describe, expect, it } from 'vitest';
import type { ReportData } from '@/core/reportModel';
import { renderReportDocument, validateReport } from '@/services/reports';
import { readTypeData, writeTypeData } from '@/services/reports/ReportTypeService';
import { createNewReport, loadReport, saveReport, type SyncDeps } from '@/services/reportSyncService';
import {
  MAIN_SWITCHGEAR_CHECKLIST, appendDefectsToSummary, collectMainPanelDefects, duplicateCell, hasMainPanelDefect, itemNoteKey,
  mainPanelService as svc, normalizeMainPanel, readItemNotes, writeItemNote, type MainPanelReport,
} from '@/services/reports/types/mainPanel.service';
import { classifyRatio, computeRow, correctForTemperature, insulationBlock, makeInsulationRow, normalizeInsulationTable } from '@/services/shared/insulation';
import { APPROVAL_OPTIONS } from '@/services/shared/approval';
import { DEFECT_REPAIR_DECLARATION } from '@/services/shared/defectRepair';
import { legacyMainPanelReportData } from './fixtures/legacyMainPanelReport';
import { legacyLoadMainPanel, legacyMainPanelRenderSmoke } from './legacyApp';
import { memoryStore } from './memoryStore';

const report = () => legacyMainPanelReportData() as unknown as ReportData;

describe('בדיקות בידוד — חישוב וסיווג כמו בישן', () => {
  it('DAR = R60/R15; ספים 1.0 / 1.25', () => {
    expect(computeRow('dar', { ...makeInsulationRow(), r15: '1000', r60: '1500' })).toMatchObject({ result: '1.50', auto: { tone: 'ok' } });
    expect(classifyRatio('dar', 1.1)).toEqual({ label: 'נדרש בדיקה נוספת', tone: 'warn' });
    expect(classifyRatio('dar', 0.9)?.tone).toBe('bad');
  });
  it('PI: ספים 1.0 / 2.0; תוויות R1/R10 דקות', () => {
    const c = computeRow('pi', { ...makeInsulationRow(), r15: '100', r60: '150' });
    expect(c.labels).toMatchObject({ v1: 'R (1 דקה)', v2: 'R (10 דקות)', ratio: 'PI' });
    expect(c.auto).toEqual({ label: 'נדרש בדיקה נוספת', tone: 'warn' });
  });
  it('ערך בודד: תיקון ל-20°C (חצייה בכל 10°C), בלי סיווג אוטומטי', () => {
    expect(correctForTemperature(100, 30)).toBe(200);
    const c = computeRow('spot', { ...makeInsulationRow(), r15: '100', temp: '10', unit: 'GΩ' });
    expect(c.result).toBe('50.00 GΩ');
    expect(c.auto).toBeNull();
  });
  it('נרמול: 3 שורות תמיד, שיטה לא מוכרת → dar; הדפסה רק של שורות עם נתונים', () => {
    const t = normalizeInsulationTable({ rows: [{ r15: '5', r60: '10' }], testMethod: 'xyz' });
    expect(t.rows).toHaveLength(3);
    expect(t.testMethod).toBe('dar');
    const b = insulationBlock(t)! as { rows: string[][] };
    expect(b.rows).toEqual([['מתח גבוה להארקה', '5 MΩ', '10 MΩ', 'תקין (2.00)', '']]);
    expect(insulationBlock(normalizeInsulationTable({}))).toBeNull();
  });
});

describe('לוח חשמל ראשי — נרמול ופעולות', () => {
  it('משלים שדות חסרים בלי לאבד נתונים (summaryCT, תאים, שורות בידוד, facilities, panelRows)', () => {
    const d = normalizeMainPanel(legacyMainPanelReportData().mainPanelReport);
    expect(d.mainSwitchgear.assemblyDetails.summaryCT).toEqual({ type: '', model: '', va: '', alf: '', ratio: '' });
    expect(d.hvCells[0].breakerType).toBe('');
    expect(d.hvCells[0].cellName).toBe('כניסה 1');
    expect(d.insulationTests.rows).toHaveLength(3);
    expect(d.facilities[0]).toMatchObject({ id: 'panel_f1', powerSupplies: [{ id: 'ps1' }] });
    expect(d.mainSwitchgear.panelRows).toEqual([{ panelName: 'שורה ישנה' }]);
    expect(Object.keys(d.mainSwitchgear.checklist)).toHaveLength(MAIN_SWITCHGEAR_CHECKLIST.length);
  });
  it('דוח חדש: מבנה זהה ל-newState().mainPanelReport בישן (כולל לוח ברירת מחדל)', () => {
    const e = svc.createEmpty();
    expect(Object.keys(e).sort()).toEqual(['accompaniedBy', 'electricalApproval', 'facilities', 'hvCells', 'insulationTests', 'mainSwitchgear', 'protectionMethod', 'summaryItems', 'testInstruments']);
    expect((e.facilities[0] as { hvVisualChecks: unknown[] }).hvVisualChecks).toHaveLength(35);
    expect(e.insulationTests.rows).toHaveLength(3);
  });
  it('הערה לפריט נשמרת ב-itemNotes במפתח של הישנה, בלי לגעת בהערות של דוחות אחרים', () => {
    const r = report();
    writeItemNote(r, 5, 'נמצא אבק');
    expect(readItemNotes(r)[itemNoteKey(5)]).toBe('נמצא אבק');
    expect(readItemNotes(r)['panels.p1.checklist|0']).toBe('שייך לדוח אחר');
    writeItemNote(r, 5, '  ');
    expect(itemNoteKey(5) in readItemNotes(r)).toBe(false);
  });
  it('שכפול תא: עותק עמוק מיד אחרי המקור', () => {
    const d = normalizeMainPanel(legacyMainPanelReportData().mainPanelReport);
    const cells = duplicateCell(d.hvCells, 0);
    expect(cells).toHaveLength(3);
    cells[1].cellName = 'שונה';
    expect(cells[0].cellName).toBe('כניסה 1');
  });
});

describe('ליקויים והצהרת חשמלאי לתיקון ליקוי (hasMainPanelDefect)', () => {
  it('ליקוי במסדר (עם ההערה), בבידוד, ובלוח ישן', () => {
    const r = report();
    const d = readTypeData(svc, r);
    expect(collectMainPanelDefects(d, r)).toEqual([{ where: 'מסדר מתח גבוה', text: 'בדיקת חיזוק הלוח לקרקע — חסר חיזוק ברגי בסיס' }]);
    d.insulationTests.rows[1] = { ...makeInsulationRow(), r15: '100', r60: '90' };
    (d.facilities[0] as { testItems: Array<{ status: string }> }).testItems[0].status = 'X';
    expect(collectMainPanelDefects(d, r).map((f) => f.where)).toEqual(['מסדר מתח גבוה', 'מסדר מתח גבוה', 'לוח ראשי']);
  });
  it('אישור חשמול שאינו "מאושר" = ליקוי, גם בלי סטטוס לא תקין', () => {
    const r = report();
    const d = readTypeData(svc, r);
    d.mainSwitchgear.checklist['3'] = 'ok';
    expect(hasMainPanelDefect(d, r)).toBe(false);
    r.approvalStatus = APPROVAL_OPTIONS[1];
    expect(hasMainPanelDefect(d, r)).toBe(true);
  });
  it('ההצהרה מודפסת רק כשיש ליקוי, בהצהרות, עם הפרטים שמולאו', () => {
    const r = report();
    r.defectRepairElectricianName = 'יוסי';
    r.defectRepairDate = '2026-11-10';
    const doc = renderReportDocument(r, null);
    const s = doc.sections.find((x) => x.id === 'defect-repair')!;
    expect(s.zone).toBe('declaration');
    expect(s.blocks[0]).toMatchObject({ kind: 'signoff', text: DEFECT_REPAIR_DECLARATION, person: { name: 'יוסי', date: '10.11.2026', licenseNo: '' } });
    const d = readTypeData(svc, r); d.mainSwitchgear.checklist['3'] = 'ok'; writeTypeData(svc, r, d);
    expect(renderReportDocument(r, null).sections.some((x) => x.id === 'defect-repair')).toBe(false);
  });
  it('העתקת ליקויים לממצאים בלי כפילויות', () => {
    const r = report();
    const d = readTypeData(svc, r);
    const once = appendDefectsToSummary(d, collectMainPanelDefects(d, r));
    expect(appendDefectsToSummary(once, collectMainPanelDefects(d, r)).summaryItems.map((s) => s.number)).toEqual([1, 2]);
  });
});

describe('מסמך — כמו buildMainPanelReportBlocks', () => {
  it('סדר: מסדר → בדיקה ויזואלית → תאים → בידוד → ממצאים → … → הערות בודק → תיקון ליקוי → חתימה', () => {
    const doc = renderReportDocument(report(), null);
    expect(doc.sections.map((s) => s.title)).toEqual([
      'מסדר מתח גבוה', 'מסדר מתח גבוה — בדיקה ויזואלית', 'תאי מתח גבוה', 'בדיקות בידוד', 'ממצאים מסכמים', 'הערות בודק', 'הצהרת חשמלאי לתיקון ליקוי', 'חתימה',
    ]);
    expect(doc.title).toBe('דוח בדיקת לוח חשמל ראשי');
  });
  it('פרטי מסדר עם יחידות; משני זרם ריקים לא מודפסים; פריטים בלי סטטוס לא מודפסים; הערת פריט מודפסת', () => {
    const doc = renderReportDocument(report(), null);
    const det = doc.sections[0].blocks as Array<{ caption?: string; rows: Array<{ label: string; value: string }> }>;
    expect(det.map((b) => b.caption)).toEqual(['פרטי מסדר מתח גבוה', 'משנה זרם מדידה']);
    expect(det[0].rows.find((r) => r.label === 'מתח נקוב')!.value).toBe('22 kV');
    const visual = doc.sections[1].blocks[0] as { rows: string[][] };
    expect(visual.rows).toHaveLength(10);
    expect(visual.rows[3]).toEqual(['בדיקת חיזוק הלוח לקרקע', 'לא תקין', 'חסר חיזוק ברגי בסיס']);
    const cells = doc.sections[2].blocks;
    expect(cells).toHaveLength(1); // התא הריק לא מודפס
  });
  it('בדיקות לפני הפקה: אישור חשמול חסר = שגיאה; לא תקין בלי הערה = אזהרה', () => {
    const r = report();
    expect(validateReport(r).find((i) => i.path === 'approvalStatus')?.severity).toBe('error');
    const d = readTypeData(svc, r); d.mainSwitchgear.checklist['7'] = 'bad'; writeTypeData(svc, r, d);
    expect(validateReport(r).some((i) => i.path === 'mainSwitchgear.checklist.7')).toBe(true);
    r.approvalStatus = APPROVAL_OPTIONS[0];
    expect(validateReport(r).some((i) => i.message.includes('"מתקן חשמל מאושר" נבחר'))).toBe(true);
  });
});

describe('תאימות דו-כיוונית מול הישנה', () => {
  async function seed() {
    const m = memoryStore();
    const legacy = legacyMainPanelReportData();
    await m.store.insert({ id: 'mp-1', project_id: null, client_id: null, report_number: legacy.meta.reportNumber, report_type: 'MAIN_PANEL', report_title: null,
      status: 'draft', inspection_date: null, report_data: legacy as unknown as ReportData, created_by: 'u0' });
    const deps: SyncDeps = { store: m.store, deviceId: 'dev_new', userId: 'u1' };
    return { m, deps, legacy };
  }

  it('עריכה בחדשה → שמירה: אותם מפתחות, נתונים שלא נערכו זהים, והישנה טוענת בלי לאבד דבר', async () => {
    const { m, deps, legacy } = await seed();
    const loaded = (await loadReport(m.store, 'mp-1'))!;
    const d: MainPanelReport = readTypeData(svc, loaded.data);
    d.mainSwitchgear.checklist['20'] = 'bad';
    d.mainSwitchgear.assemblyDetails.summaryCT.ratio = '100/1';
    d.hvCells.push({ ...d.hvCells[0], cellName: 'יציאה 2' });
    d.insulationTests.testMethod = 'pi';
    d.insulationTests.rows[2] = { ...makeInsulationRow(), r15: '500', r60: '1200', note: 'תקין' };
    writeTypeData(svc, loaded.data, d);
    writeItemNote(loaded.data, 20, 'קורוזיה בדלת');
    loaded.data.approvalStatus = APPROVAL_OPTIONS[2];
    loaded.data.defectRepairElectricianName = 'יוסי';
    loaded.data.settings.cloudEditSeq = 1;
    expect((await saveReport(deps, loaded.data)).kind).toBe('saved');

    const stored = structuredClone(m.rows.get('mp-1')!.report_data) as unknown as Record<string, unknown>;
    expect(Object.keys(stored).sort()).toEqual(Object.keys(legacy).sort());
    expect((stored.itemPhotos as object)).toEqual(legacy.itemPhotos);
    expect((stored.itemNotes as Record<string, string>)['panels.p1.checklist|0']).toBe('שייך לדוח אחר');
    const mp = stored.mainPanelReport as Record<string, unknown>;
    expect(Object.keys(mp).sort()).toEqual(Object.keys(legacy.mainPanelReport).sort());
    expect(mp.facilities).toEqual(legacy.mainPanelReport.facilities);

    const state = legacyLoadMainPanel(stored);
    legacyMainPanelRenderSmoke(state);
    const lmp = state.mainPanelReport;
    expect(lmp.mainSwitchgear.checklist['20']).toBe('bad');
    expect(lmp.mainSwitchgear.checklist['3']).toBe('bad');
    expect(lmp.mainSwitchgear.assemblyDetails.summaryCT.ratio).toBe('100/1');
    expect(lmp.mainSwitchgear.panelRows).toEqual([{ panelName: 'שורה ישנה' }]);
    expect(lmp.hvCells.map((c: { cellName: string }) => c.cellName)).toEqual(['כניסה 1', '', 'יציאה 2']);
    expect(lmp.insulationTests.testMethod).toBe('pi');
    expect(lmp.insulationTests.rows[2]).toMatchObject({ r15: '500', r60: '1200', note: 'תקין' });
    expect(state.itemNotes['mainPanelReport.mainSwitchgear.checklist|20']).toBe('קורוזיה בדלת');
    expect(state.approvalStatus).toBe(APPROVAL_OPTIONS[2]);
    expect(state.defectRepairElectricianName).toBe('יוסי');
    expect(lmp.accompaniedBy).toBe('אב הבית');
  });

  it('דוח חדש מהחדשה נטען בישנה', async () => {
    const m = memoryStore();
    const deps: SyncDeps = { store: m.store, deviceId: 'd', userId: 'u', newId: () => 'new-mp', localCounter: { get: () => null, set: () => {} } };
    const r = await createNewReport(deps, 'MAIN_PANEL');
    expect(r.meta.reportNumber).toMatch(/^HV-/);
    r.meta.client = 'x';
    await saveReport(deps, r);
    legacyMainPanelRenderSmoke(legacyLoadMainPanel(structuredClone(m.rows.get('new-mp')!.report_data)));
  });
});
