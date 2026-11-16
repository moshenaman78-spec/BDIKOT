import { describe, expect, it } from 'vitest';
import { formatReportNumber, nextReportNumber, reportNumberPrefix, sanitizeBrandForPrefix } from '@/services/reportNumber';
import { memoryStore } from './memoryStore';

describe('מספר דוח', () => {
  it('פורמט PREFIX-מונה-MM-YYYY', () => {
    expect(formatReportNumber('HV', 1064, new Date(2026, 7, 3))).toBe('HV-1064-08-2026');
  });
  it('קידומות לפי סוג', () => {
    expect(reportNumberPrefix('SOIL')).toBe('GEO');
    expect(reportNumberPrefix('MAIN_PANEL')).toBe('HV');
    expect(reportNumberPrefix('TRANSFORMER_INSPECTION')).toBe('TR');
    expect(reportNumberPrefix('PV_INSPECTION')).toBe('PV');
    expect(reportNumberPrefix('FIRE_FORM3')).toBe('F3');
    expect(reportNumberPrefix('GENERAL')).toBe('RPT');
    expect(reportNumberPrefix('SMA', 'Solar-Edge')).toBe('SOLAREDGE');
    expect(sanitizeBrandForPrefix('סולאר')).toBe('SMA');
  });
  it('מונה מהשרת; בלי שרת — מונה מקומי מ-1000', async () => {
    const now = new Date(2026, 10, 1);
    expect(await nextReportNumber(memoryStore({ counter: 1500 }).store, 'GENERAL', { now })).toBe('RPT-1500-11-2026');
    let v: number | null = null;
    const local = { get: () => v, set: (n: number) => { v = n; } };
    expect(await nextReportNumber(memoryStore({ counter: null }).store, 'GENERAL', { now, local })).toBe('RPT-1000-11-2026');
    expect(await nextReportNumber(memoryStore({ counter: null }).store, 'GENERAL', { now, local })).toBe('RPT-1001-11-2026');
  });
});
