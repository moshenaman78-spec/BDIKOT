/**
 * HV_CABLE — דוח בדיקת כבל מתח גבוה (VLF). סעיפים: 01 פרטי המתקן, 02 סוג הבדיקה,
 * 03 פרטי כבל, 04 אופן הבדיקה, 05 טבלת סיכום, 06 סיכום; הצהרות מ-07.
 * TODO(HV_CABLE): להעביר מ-renderHvCableReportCards (שורה ~16879), makeHvCableRow, makeHvCableEquipmentRow.
 */
import { defineReportService, mergeDefaults } from '../ReportTypeService';
import { fieldsBlock, newId } from '../helpers';

export interface HvCableRow {
  id: string; name: string; phase: string; testVoltageKv: string; durationMin: string;
  leakageMa: string; tanDelta: string; result: '' | 'עבר' | 'נכשל';
}
export interface HvCableData {
  testKind: 'VLF' | 'VLF+TD' | 'DC' | '';
  cableType: string; crossSection: string; lengthM: string; ratedVoltage: string;
  method: string;
  rows: HvCableRow[];
  legacy: Record<string, unknown>;
}
export const makeHvCableRow = (name = ''): HvCableRow => ({ id: newId(), name, phase: '', testVoltageKv: '', durationMin: '60', leakageMa: '', tanDelta: '', result: '' });

const createEmpty = (): HvCableData => ({ testKind: 'VLF', cableType: '', crossSection: '', lengthM: '', ratedVoltage: '', method: '', rows: ['L1', 'L2', 'L3'].map(makeHvCableRow), legacy: {} });

export const hvCableService = defineReportService<HvCableData>('HV_CABLE', {
  isSkeleton: true,
  createEmpty,
  normalize: (raw) => mergeDefaults(createEmpty(), raw),
  buildSections: (d) => [
    { id: 'hv-kind', zone: 'content', title: 'סוג הבדיקה', blocks: [fieldsBlock([['סוג', d.testKind]])] },
    { id: 'hv-cable', zone: 'content', title: 'פרטי כבל', blocks: [fieldsBlock([['סוג כבל', d.cableType], ['חתך', d.crossSection], ['אורך [m]', d.lengthM], ['מתח נקוב', d.ratedVoltage]])] },
    ...(d.method ? [{ id: 'hv-method', zone: 'content' as const, title: 'אופן הבדיקה', blocks: [{ kind: 'paragraph' as const, text: d.method }] }] : []),
    { id: 'hv-table', zone: 'content', title: 'טבלת סיכום', blocks: [{
      kind: 'table', columns: ['גיד', 'פאזה', 'מתח בדיקה [kV]', 'משך [דק׳]', 'זליגה [mA]', 'tanδ', 'תוצאה'],
      rows: d.rows.map((r) => [r.name, r.phase, r.testVoltageKv, r.durationMin, r.leakageMa, r.tanDelta, r.result]),
    }] },
  ],
  findings: (d) => d.rows.filter((r) => r.result === 'נכשל').map((r) => ({ where: `גיד ${r.name}`, text: 'נכשל בבדיקת VLF' })),
});
