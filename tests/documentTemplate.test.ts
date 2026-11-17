import { describe, expect, it } from 'vitest';
import { emptyMeta, emptySettings, formatLastUpdated, type ReportData } from '@/core/reportModel';
import { REPORT_TYPE_CODES, REPORT_TYPES, type ReportTypeCode } from '@/core/reportTypes';
import { renderReportDocument, serviceFor, writeTypeData } from '@/services/reports';
import { cssVariables } from '@/styles/tokens';

function report(code: ReportTypeCode, typeData?: object): ReportData {
  const data: ReportData = {
    meta: { ...emptyMeta(), reportNumber: 'RPT-1000-11-2026', client: 'לקוח', date: '2026-11-16' },
    settings: emptySettings(REPORT_TYPES[code].nameHe),
    notes: ['הערה א', '', 'הערה ב'],
  };
  const svc = serviceFor(code);
  writeTypeData(svc, data, typeData ?? svc.createEmpty());
  return data;
}

describe('תבנית המסמך', () => {
  it.each(REPORT_TYPE_CODES)('%s: נבנה מסמך בלי שגיאה', (code) => {
    const doc = renderReportDocument(report(code), '2026-11-16T12:34:00Z');
    expect(doc.typeCode).toBe(code);
    expect(doc.sections.length).toBeGreaterThan(0);
  });

  it('סדר: מתקן → תוכן → סיכום → הערות → הצהרה → חתימה, ממוספר 01..', () => {
    const r = report('SMA');
    (r.typeData as { facilities: Array<{ measurements: unknown[] }> }).facilities[0].measurements.push({ label: 'בידוד', value: '0.1', unit: 'MΩ', pass: false });
    const doc = renderReportDocument(r, null);
    const zones = doc.sections.map((s) => s.zone);
    // "פרטי המתקן" בעמוד השער (כמו בישן), לא כסעיף
    expect(zones).toEqual(['content', 'summary', 'notes', 'declaration', 'signature']);
    expect(doc.sections.map((s) => s.number)).toEqual(['01', '02', '03', '04', '05']);
    expect(doc.cover?.title).toBe('טיפול בממירי SMA');
  });

  it('הערות: מחרוזות ריקות לא מודפסות; הצהרה = 5 הקבועות + נוספת', () => {
    const r = report('GENERAL');
    r.customDeclaration = 'הצהרה נוספת';
    const doc = renderReportDocument(r, null);
    const notes = doc.sections.find((s) => s.zone === 'notes')!.blocks[0] as { items: string[] };
    expect(notes.items).toEqual(['הערה א', 'הערה ב']);
    const decl = doc.sections.find((s) => s.zone === 'declaration')!.blocks[0] as { items: string[] };
    expect(decl.items).toHaveLength(6);
    expect(decl.items[5]).toBe('הצהרה נוספת');
  });

  it('שירות שמחזיר אזור "notes" מוחזר לתוכן — הערות/הצהרה תמיד בסוף', () => {
    const svc = serviceFor('GENERAL');
    const orig = svc.buildSections;
    svc.buildSections = () => [{ id: 'x', zone: 'notes', title: 'טקסט', blocks: [] }];
    const doc = renderReportDocument(report('GENERAL'), null);
    svc.buildSections = orig;
    expect(doc.sections.find((s) => s.id === 'x')!.zone).toBe('content');
  });

  it('מספר הדוח לא מופיע בתוך סעיפי הדוח (רק בכותרת)', () => {
    const doc = renderReportDocument(report('SOIL'), null);
    expect(doc.reportNumber).toBe('RPT-1000-11-2026');
    expect(JSON.stringify(doc.sections)).not.toContain('RPT-1000-11-2026');
  });

  it('"עודכן לאחרונה" כולל שעה (שעון ישראל)', () => {
    expect(formatLastUpdated('2026-11-16T12:34:00Z')).toBe('16.11.2026 14:34');
    expect(formatLastUpdated(null)).toBe('');
  });

  it('טופס 3 — טופס רשמי בלי סעיפי החברה', () => {
    const doc = renderReportDocument(report('FIRE_FORM3'), null);
    expect(doc.documentKind).toBe('official-form');
    expect(doc.sections.some((s) => s.zone === 'declaration')).toBe(false);
  });

  it('שנאי: נכתב למפתח הישן transformerInspectionReport ולא ל-typeData', () => {
    const r = report('TRANSFORMER_INSPECTION');
    expect(r.transformerInspectionReport).toBeTruthy();
    expect(r.typeData).toBeUndefined();
  });

  it('normalize שומר שדות לא מוכרים (אין איבוד נתונים מהגרסה הישנה)', () => {
    const n = serviceFor('SMA').normalize({ facilities: [], legacy: {}, someOldField: 42 });
    expect((n as Record<string, unknown>).someOldField).toBe(42);
    expect(n.facilities.length).toBe(1);
  });

  it('פלטת הצבעים מייצרת משתני CSS', () => {
    const css = cssVariables();
    expect(css).toContain('--sh-navy:#0F2E4D');
    expect(css).toContain('--sh-add:');
    expect(css).toContain('--sh-font-ui:');
  });
});
