import { describe, expect, it } from 'vitest';
import { classifyZeroRowUpdate, decideFreshness, decideSave, diffReportData, verdictForUnknownVersion } from '@/services/sync/saveRules';

const base = { cloudReportId: 'r1', insertPending: false, insertRequiresContent: false, hasMeaningfulContent: true, online: true, knownUpdatedAt: 't1' };
const meta = (o: Partial<{ updated_at: string; status: string; saved_by_device: string | null }> = {}) =>
  ({ id: 'r1', updated_at: 't1', status: 'draft', saved_by_device: 'dev-A', ...o });

describe('decideSave', () => {
  it('אין זהות → חסום (אין יצירה שקטה)', () => expect(decideSave({ ...base, cloudReportId: null }).action).toBe('blocked-no-identity'));
  it('לא מקוון → תור', () => expect(decideSave({ ...base, online: false }).action).toBe('queue-offline'));
  it('דוח חדש מפורש → insert', () => expect(decideSave({ ...base, insertPending: true }).action).toBe('insert'));
  it('דוח אוטומטי ריק → לא נוצר', () => expect(decideSave({ ...base, insertPending: true, insertRequiresContent: true, hasMeaningfulContent: false }).action).toBe('skip-empty'));
  it('גרסה ידועה → UPDATE מותנה', () => expect(decideSave(base)).toEqual({ action: 'conditional-update', known: 't1' }));
  it('גרסה לא ידועה → אימות קודם', () => expect(decideSave({ ...base, knownUpdatedAt: null }).action).toBe('verify-version-first'));
});

describe('אימות גרסה ו-0 שורות', () => {
  it('מאמץ רק אם המכשיר הזה שמר אחרון', () => {
    expect(verdictForUnknownVersion(meta(), 'dev-A')).toEqual({ kind: 'adopt', known: 't1' });
    expect(verdictForUnknownVersion(meta(), 'dev-B')).toEqual({ kind: 'conflict' });
    expect(verdictForUnknownVersion(meta({ status: 'archived' }), 'dev-A')).toEqual({ kind: 'deleted' });
    expect(verdictForUnknownVersion(null, 'dev-A')).toEqual({ kind: 'missing' });
  });
  it('0 שורות: חסר / נמחק / קונפליקט', () => {
    expect(classifyZeroRowUpdate(null)).toBe('missing');
    expect(classifyZeroRowUpdate(meta({ status: 'deleted' }))).toBe('deleted');
    expect(classifyZeroRowUpdate(meta())).toBe('conflict');
  });
});

describe('decideFreshness', () => {
  it('אותה גרסה → current', () => expect(decideFreshness({ meta: meta(), known: 't1', deviceId: 'x', localDirty: true })).toBe('current'));
  it('גרסה חדשה בענן ואין שינויים מקומיים → טעינה', () => expect(decideFreshness({ meta: meta({ updated_at: 't2' }), known: 't1', deviceId: 'x', localDirty: false })).toBe('reload-from-cloud'));
  it('גרסה חדשה בענן ויש שינויים → קונפליקט', () => expect(decideFreshness({ meta: meta({ updated_at: 't2' }), known: 't1', deviceId: 'x', localDirty: true })).toBe('conflict'));
  it('tombstone', () => expect(decideFreshness({ meta: meta({ status: 'archived' }), known: 't1', deviceId: 'x', localDirty: false })).toBe('tombstone'));
});

describe('diffReportData', () => {
  it('מחזיר רק עלים שונים ומתעלם משדות סנכרון', () => {
    const a = { meta: { client: 'א', date: '1' }, settings: { savedByDevice: 'A', cloudEditSeq: 3 } };
    const b = { meta: { client: 'ב', date: '1' }, settings: { savedByDevice: 'B', cloudEditSeq: 0 } };
    expect(diffReportData(a, b)).toEqual([{ path: 'meta.client', local: 'א', cloud: 'ב' }]);
  });
});
