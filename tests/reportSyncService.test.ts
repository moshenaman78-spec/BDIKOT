import { describe, expect, it } from 'vitest';
import { createNewReport, loadReport, resolveCompare, resolveSaveAsCopy, saveReport, type SyncDeps } from '@/services/reportSyncService';
import { createVersion, restoreVersion } from '@/services/versionService';
import { memoryStore } from './memoryStore';

function setup(deviceId = 'dev-A') {
  const m = memoryStore();
  let n = 0;
  const deps: SyncDeps = { store: m.store, deviceId, userId: 'user-1', newId: () => `id-${++n}`, localCounter: { get: () => null, set: () => {} } };
  return { m, deps };
}

describe('שמירה לענן', () => {
  it('דוח חדש: INSERT אחד, ואז UPDATE לאותו UUID — המספר לא משתנה', async () => {
    const { m, deps } = setup();
    const r = await createNewReport(deps, 'MAIN_PANEL');
    r.meta.client = 'לקוח';
    expect(await saveReport(deps, r)).toMatchObject({ kind: 'saved', created: true });
    const num = r.meta.reportNumber;
    r.meta.client = 'לקוח 2';
    expect(await saveReport(deps, r)).toMatchObject({ kind: 'saved', created: false });
    expect(m.calls.insert).toBe(1);
    expect(m.rows.size).toBe(1);
    expect(m.rows.get(r.settings.cloudReportId!)!.report_number).toBe(num);
    expect(m.rows.get(r.settings.cloudReportId!)!.report_data.meta.client).toBe('לקוח 2');
  });

  it('דוח בלי זהות → חסום, שום דבר לא נכתב', async () => {
    const { m, deps } = setup();
    const r = await createNewReport(deps, 'SOIL');
    r.settings.cloudReportId = null;
    expect((await saveReport(deps, r)).kind).toBe('blocked');
    expect(m.calls.insert + m.calls.update).toBe(0);
  });

  it('עריכה ממכשיר אחר → קונפליקט, הענן לא נדרס', async () => {
    const { m, deps } = setup();
    const r = await createNewReport(deps, 'GENERAL');
    r.meta.client = 'מקור';
    await saveReport(deps, r);
    m.touchFromOtherDevice(r.settings.cloudReportId!);
    m.rows.get(r.settings.cloudReportId!)!.report_data.meta.client = 'מכשיר B';
    r.meta.client = 'מכשיר A';
    expect(await saveReport(deps, r)).toEqual({ kind: 'conflict', deleted: false });
    expect(m.rows.get(r.settings.cloudReportId!)!.report_data.meta.client).toBe('מכשיר B');
  });

  it('דוח שאורכב בענן → קונפליקט "נמחק", בלי INSERT חלופי', async () => {
    const { m, deps } = setup();
    const r = await createNewReport(deps, 'GENERAL');
    r.meta.client = 'x';
    await saveReport(deps, r);
    await m.store.archiveExplicit(r.settings.cloudReportId!, 'draft');
    m.rows.get(r.settings.cloudReportId!)!.updated_at = 'changed';
    expect(await saveReport(deps, r)).toEqual({ kind: 'conflict', deleted: true });
    expect(m.calls.insert).toBe(1);
  });

  it('שמירת דוח לא מארכבת אף דוח אחר', async () => {
    const { m, deps } = setup();
    for (let i = 0; i < 7; i++) { const r = await createNewReport(deps, 'SOIL'); r.meta.client = `c${i}`; await saveReport(deps, r); }
    expect([...m.rows.values()].every((r) => r.status === 'draft')).toBe(true);
    expect(m.calls.archive).toBe(0);
  });

  it('מספר דוח תפוס לפני יצירה → מוקצה חדש', async () => {
    const { m, deps } = setup();
    const a = await createNewReport(deps, 'SOIL'); a.meta.client = 'a'; await saveReport(deps, a);
    const b = await createNewReport(deps, 'SOIL'); b.meta.client = 'b'; b.meta.reportNumber = a.meta.reportNumber;
    await saveReport(deps, b);
    expect(b.meta.reportNumber).not.toBe(a.meta.reportNumber);
    expect(m.rows.size).toBe(2);
  });
});

describe('חלונית קונפליקט', () => {
  it('שמור כעותק: דוח חדש עם מספר חדש, המקור לא נוגע', async () => {
    const { m, deps } = setup();
    const r = await createNewReport(deps, 'GENERAL'); r.meta.client = 'מקור'; await saveReport(deps, r);
    m.touchFromOtherDevice(r.settings.cloudReportId!);
    r.meta.client = 'שלי';
    const before = m.rows.get(r.settings.cloudReportId!)!.updated_at;
    const { copy, outcome } = await resolveSaveAsCopy(deps, r);
    expect(outcome).toMatchObject({ kind: 'saved', created: true });
    expect(copy.settings.cloudReportId).not.toBe(r.settings.cloudReportId);
    expect(copy.meta.reportNumber).not.toBe(r.meta.reportNumber);
    expect(m.rows.get(r.settings.cloudReportId!)!.updated_at).toBe(before);
  });

  it('השווה: מחזיר את השדות השונים בלי לכתוב', async () => {
    const { m, deps } = setup();
    const r = await createNewReport(deps, 'GENERAL'); r.meta.client = 'מקור'; await saveReport(deps, r);
    r.meta.client = 'שלי';
    const calls = m.calls.update;
    const diff = await resolveCompare(m.store, r);
    expect(diff.map((d) => d.path)).toEqual(['meta.client']);
    expect(m.calls.update).toBe(calls);
  });

  it('טעינה מהענן מסמנת גרסה ידועה ומאפשרת שמירה', async () => {
    const { m, deps } = setup();
    const r = await createNewReport(deps, 'GENERAL'); r.meta.client = 'x'; await saveReport(deps, r);
    const loaded = await loadReport(m.store, r.settings.cloudReportId!);
    loaded!.data.meta.client = 'y';
    expect((await saveReport({ ...deps, deviceId: 'dev-B' }, loaded!.data)).kind).toBe('saved');
  });
});

describe('גרסאות', () => {
  it('שחזור גרסה עובר דרך UPDATE מותנה ויוצר גרסה חדשה', async () => {
    const { m, deps } = setup();
    const r = await createNewReport(deps, 'GENERAL'); r.meta.client = 'v1'; await saveReport(deps, r);
    await createVersion(deps, r);
    r.meta.client = 'v2'; await saveReport(deps, r);
    const { outcome, data } = await restoreVersion(deps, r, 1);
    expect(outcome.kind).toBe('saved');
    expect(data.meta.client).toBe('v1');
    expect(data.meta.reportNumber).toBe(r.meta.reportNumber);
    expect(m.versions.map((v) => v.version_number)).toEqual([1, 2]);
  });

  it('שחזור כשמכשיר אחר שמר בינתיים → קונפליקט, בלי דריסה', async () => {
    const { m, deps } = setup();
    const r = await createNewReport(deps, 'GENERAL'); r.meta.client = 'v1'; await saveReport(deps, r);
    await createVersion(deps, r);
    m.touchFromOtherDevice(r.settings.cloudReportId!);
    expect((await restoreVersion(deps, r, 1)).outcome.kind).toBe('conflict');
    expect(m.versions).toHaveLength(1);
  });
});
