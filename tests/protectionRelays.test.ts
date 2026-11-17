import { describe, expect, it } from 'vitest';
import { emptyMeta, emptySettings, type ReportData } from '@/core/reportModel';
import { REPORT_TYPE_CODES, REPORT_TYPES, type ReportTypeCode } from '@/core/reportTypes';
import { renderReportDocument, serviceFor, validateReport, writeTypeData } from '@/services/reports';
import { loadReport, saveReport, type SyncDeps } from '@/services/reportSyncService';
import {
  RELAY_LIBRARY, RELAY_MODEL_NAMES, RELAY_REPORT_TYPES, addRelay, displayUnit, duplicateRelay, fieldKey, isPrintable, makeProtectionRelay,
  normalizeRelay, readRelays, relayDipBits, relayFindings, relaySelectOptions, relaysSection, removeRelay, toggleDip, writeRelays,
  type ProtectionRelay,
} from '@/services/shared/protectionRelays';
import { legacyTransformerReportData } from './fixtures/legacyTransformerReport';
import { legacyLoad } from './legacyApp';
import { memoryStore } from './memoryStore';

function report(code: ReportTypeCode, relays: unknown[]): ReportData {
  const data: ReportData = { meta: { ...emptyMeta(), reportNumber: 'X-1' }, settings: emptySettings(REPORT_TYPES[code].nameHe), notes: [''], protectionRelays: relays };
  const svc = serviceFor(code);
  writeTypeData(svc, data, svc.createEmpty());
  return data;
}

/** ממסר כפי שהישנה שומרת אותו (מפתחות הגדרה מקודדים: I> → Igt). */
const legacyAbb = () => ({
  id: 'rel_x1', model: 'ABB REJ603', location: 'מסדר מ"ג — תא 3',
  info: { serial: 'SN-77', ctType: '' }, settings: { Igt: '1.2', tgt: '0.3', curve: 'NI — הפוך נורמלי', Igtgt: '8', Iogt: '' },
  dips: { S1: '10100000', S3: '1' }, extra: { tripTest: 'תקין', injection: 'לא תקין' }, notes: 'הזרקה נכשלה ב-L2', collapsed: true,
});

describe('ספריית הדגמים — 1:1 מהישן', () => {
  it('3 דגמים, כולל "אחר"', () => expect(RELAY_MODEL_NAMES).toEqual(['ABB REJ603', 'Kries IKI-30', 'אחר']));
  it('מתגי DIP: ABB 6×8, Kries 12/5/10/5, אחר בלי', () => {
    expect(RELAY_LIBRARY['ABB REJ603'].dips.map((d) => d[2])).toEqual([8, 8, 8, 8, 8, 8]);
    expect(RELAY_LIBRARY['Kries IKI-30'].dips.map((d) => d[2])).toEqual([12, 5, 10, 5]);
    expect(RELAY_LIBRARY['אחר'].dips).toHaveLength(0);
  });
  it('סוגי דוח: SMA, שנאי, לוח ראשי', () => expect(RELAY_REPORT_TYPES).toEqual(['SMA', 'TRANSFORMER_INSPECTION', 'MAIN_PANEL']));
  it('קידוד מפתחות כמו בישן', () => {
    expect(fieldKey('I>')).toBe('Igt');
    expect(fieldKey('I>>')).toBe('Igtgt');
    expect(fieldKey('Io>')).toBe('Iogt');
    expect(fieldKey('t<')).toBe('tlt');
    expect(fieldKey('a b')).toBe('a_b');
    expect(fieldKey('serial')).toBe('serial');
  });
  it('אפשרויות בחירה', () => {
    expect(relaySelectOptions('select:status')).toEqual(['תקין', 'לא תקין', 'לא נבדק']);
    expect(relaySelectOptions('select:curve')).toHaveLength(5);
    expect(relaySelectOptions('select:3V / 0,02Ws|24V / 0,1Ws|External Buffered')).toEqual(['3V / 0,02Ws', '24V / 0,1Ws', 'External Buffered']);
  });
  it('relayDipBits: ריפוד/חיתוך לאורך הקבוצה', () => {
    expect(relayDipBits('101', 5)).toBe('10100');
    expect(relayDipBits('1111111111', 4)).toBe('1111');
    expect(relayDipBits(undefined, 3)).toBe('000');
    expect(relayDipBits('1x1', 3)).toBe('101');
  });
});

describe('פעולות', () => {
  it('ממסר חדש: אותו מבנה כמו makeProtectionRelay בישן', () => {
    const r = makeProtectionRelay('Kries IKI-30');
    expect(Object.keys(r).sort()).toEqual(['collapsed', 'dips', 'extra', 'id', 'info', 'location', 'model', 'notes', 'settings']);
    expect(r.id).toMatch(/^rel_/);
    expect(makeProtectionRelay().model).toBe('ABB REJ603');
  });
  it('נרמול: קבוצות חסרות → {}, שדות לא מוכרים נשמרים', () => {
    const r = normalizeRelay({ model: 'ABB REJ603', info: null, futureField: 1 });
    expect(r.info).toEqual({});
    expect(r.dips).toEqual({});
    expect(r.futureField).toBe(1);
  });
  it('מתג DIP: הפיכה של מתג אחד בלבד', () => {
    const r = normalizeRelay(legacyAbb());
    expect(toggleDip(r, 'S1', 1, 8).dips.S1).toBe('11100000');
    expect(toggleDip(r, 'S1', 0, 8).dips.S1).toBe('00100000');
    expect(toggleDip(r, 'S2', 7, 8).dips.S2).toBe('00000001');
  });
  it('שכפול: id חדש, עותק עמוק, מיד אחרי המקור; מחיקה והוספה', () => {
    const list = [normalizeRelay(legacyAbb()), makeProtectionRelay('אחר')];
    const d = duplicateRelay(list, 0);
    expect(d.map((r) => r.model)).toEqual(['ABB REJ603', 'ABB REJ603', 'אחר']);
    expect(d[1].id).not.toBe(d[0].id);
    d[1].settings.Igt = '9';
    expect(d[0].settings.Igt).toBe('1.2');
    expect(removeRelay(d, 0)).toHaveLength(2);
    expect(addRelay([], 'Kries IKI-30')[0].model).toBe('Kries IKI-30');
  });
});

describe('פלט המסמך — כמו buildProtectionRelayBlocks', () => {
  it('ממסר ריק לא מודפס, והמספור לפי הממסרים המודפסים', () => {
    const data = report('MAIN_PANEL', [makeProtectionRelay(), legacyAbb()]);
    expect(isPrintable(readRelays(data)[0])).toBe(false);
    const sec = relaysSection(data)!;
    expect(sec.blocks).toHaveLength(1);
    expect((sec.blocks[0] as { title: string }).title).toBe('ממסר הגנה #1: ABB REJ603 — מסדר מ"ג — תא 3');
  });
  it('יצרן + פרטים + בדיקות; הגדרות עם יחידה רק כשהיא יחידה אחת; DIP רק לקבוצות שנגעו בהן', () => {
    const sec = relaysSection(report('SMA', [legacyAbb()]))!;
    const card = sec.blocks[0] as { blocks: Array<{ kind: string; caption?: string; rows: unknown[] }> };
    const info = card.blocks.find((b) => b.caption === 'פרטי הממסר ובדיקות')!.rows as Array<{ label: string; value: string }>;
    expect(info.map((r) => [r.label, r.value])).toEqual([['יצרן', 'ABB'], ['מס׳ סידורי', 'SN-77'], ['בדיקת הפעלה (Trip test)', 'תקין'], ['בדיקת הזרקה משנית', 'לא תקין']]);
    const settings = card.blocks.find((b) => b.caption === 'הגדרות הגנה')!.rows;
    expect(settings).toEqual([['זרם יתר — סף (I>)', '1.2'], ['זמן / מקדם (t> / k)', '0.3 s'], ['עקומה (I>)', 'NI — הפוך נורמלי'], ['קצר — סף (I>>)', '8']]);
    const dips = card.blocks.find((b) => b.caption?.startsWith('מצב מתגי DIP'))!.rows;
    expect(dips).toEqual([['DIP S1', '■ □ ■ □ □ □ □ □'], ['DIP S3', '■ □ □ □ □ □ □ □']]);
    expect(displayUnit('×In / A')).toBe('');
    expect(displayUnit('A')).toBe('A');
  });
  it('"אחר": יצרן מהשדה החופשי', () => {
    const sec = relaysSection(report('SMA', [{ ...makeProtectionRelay('אחר'), info: { maker: 'Siemens', model: '7SJ80' } }]))!;
    const info = (sec.blocks[0] as { blocks: Array<{ caption?: string; rows: Array<{ label: string; value: string }> }> }).blocks[0].rows;
    expect(info[0]).toEqual({ label: 'יצרן', value: 'Siemens' });
  });
  it.each(REPORT_TYPE_CODES)('%s: ממסרים מודפסים רק בסוגים הנכונים, תמיד לפני הסיכום', (code) => {
    const doc = renderReportDocument(report(code, [legacyAbb()]), null);
    const idx = doc.sections.findIndex((s) => s.id === 'protection-relays');
    if (!RELAY_REPORT_TYPES.includes(code)) { expect(idx).toBe(-1); return; }
    expect(idx).toBeGreaterThanOrEqual(0);
    const firstSummary = doc.sections.findIndex((s) => s.zone !== 'facility' && s.zone !== 'content');
    expect(idx).toBeLessThan(firstSummary);
  });
});

describe('ליקויים ובדיקות לפני הפקה', () => {
  it('בדיקה "לא תקין" → ליקוי, וגם בטבלת הליקויים של סוג שלד (SMA)', () => {
    const data = report('SMA', [legacyAbb()]);
    expect(relayFindings(data)).toEqual([{ where: 'ממסר #1: ABB REJ603 — מסדר מ"ג — תא 3', text: 'בדיקת הזרקה משנית — לא תקין (הזרקה נכשלה ב-L2)' }]);
    const doc = renderReportDocument(data, null);
    expect(JSON.stringify(doc.sections.find((s) => s.id === 'findings'))).toContain('בדיקת הזרקה משנית');
  });
  it('אזהרות: ממסר ריק, חסר מיקום, לא תקין בלי הערה, דגם לא מוכר', () => {
    const data = report('TRANSFORMER_INSPECTION', [
      makeProtectionRelay(),
      { ...legacyAbb(), location: '' },
      { ...legacyAbb(), notes: '' },
      { ...legacyAbb(), model: 'SEL-751' },
    ]);
    const msgs = validateReport(data).filter((i) => i.path.startsWith('protectionRelays')).map((i) => i.path);
    expect(msgs).toEqual(['protectionRelays.0', 'protectionRelays.1.location', 'protectionRelays.2.notes', 'protectionRelays.3.model']);
  });
  it('לא נבדק בסוג שלא משתמש בממסרים', () => {
    expect(validateReport(report('GENERAL', [makeProtectionRelay()])).some((i) => i.path.startsWith('protectionRelays'))).toBe(false);
  });
});

describe('תאימות דו-כיוונית', () => {
  it('עריכה בחדשה → שמירה → טעינה בישנה: הממסרים זהים, במפתחות של הישנה', async () => {
    const m = memoryStore();
    const legacy = legacyTransformerReportData();
    await m.store.insert({ id: 'rep-1', project_id: null, client_id: null, report_number: 'TR-1', report_type: 'TRANSFORMER_INSPECTION', report_title: null,
      status: 'draft', inspection_date: null, report_data: legacy as unknown as ReportData, created_by: 'u0' });
    const deps: SyncDeps = { store: m.store, deviceId: 'dev_new', userId: 'u1' };
    const loaded = (await loadReport(m.store, 'rep-1'))!;
    let relays: ProtectionRelay[] = readRelays(loaded.data);
    relays = duplicateRelay(relays, 0);
    relays[1] = toggleDip({ ...relays[1], location: 'תא 4', settings: { ...relays[1].settings, [fieldKey('I>')]: '2.5' } }, 'S2', 0, 8);
    relays = addRelay(relays, 'Kries IKI-30');
    writeRelays(loaded.data, relays);
    loaded.data.settings.cloudEditSeq = 1;
    expect((await saveReport(deps, loaded.data)).kind).toBe('saved');

    const legacyState = legacyLoad(structuredClone(m.rows.get('rep-1')!.report_data));
    const lr = legacyState.protectionRelays;
    expect(lr).toHaveLength(3);
    expect(lr[0]).toEqual(legacy.protectionRelays[0]); // המקורי לא השתנה
    expect(lr[1].settings.Igt).toBe('2.5');
    expect(lr[1].dips).toEqual({ S1: '10100000', S2: '10000000' });
    expect(lr[1].location).toBe('תא 4');
    expect(lr[2]).toMatchObject({ model: 'Kries IKI-30', info: {}, settings: {}, dips: {}, extra: {}, notes: '', collapsed: false });
  });
});
