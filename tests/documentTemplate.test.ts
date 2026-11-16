import { describe, expect, it } from 'vitest';
import { emptyMeta, emptySettings, formatLastUpdated, type ReportData } from '@/core/reportModel';
import { REPORT_TYPE_CODES, REPORT_TYPES, type ReportTypeCode } from '@/core/reportTypes';
import { renderReportDocument, serviceFor } from '@/services/reports';
import { transformerInspectionService } from '@/services/reports/types/transformerInspection.service';
import { cssVariables } from '@/styles/tokens';

function report(code: ReportTypeCode, patch: Partial<ReportData> = {}): ReportData {
  return {
    meta: { ...emptyMeta(), reportNumber: 'RPT-1000-11-2026', client: 'לקוח', date: '2026-11-16' },
    settings: emptySettings(REPORT_TYPES[code].nameHe),
    notes: [{ id: '1', text: 'הערה א' }, { id: '2', text: 'הערה ב' }],
    summary: 'סיכום',
    typeData: serviceFor(code).createEmpty(),
    ...patch,
  };
}

describe('תבנית המסמך', () => {
  it.each(REPORT_TYPE_CODES)('%s: נבנה מסמך בלי שגיאה', (code) => {
    const doc = renderReportDocument(report(code), '2026-11-16T12:34:00Z');
    expect(doc.typeCode).toBe(code);
    expect(doc.sections.length).toBeGreaterThan(0);
  });

  it('סדר: מתקן → תוכן → סיכום → הערות → הצהרה → חתימה, ממוספר 01..', () => {
    const doc = renderReportDocument(report('MAIN_PANEL'), null);
    const zones = doc.sections.map((s) => s.zone);
    expect(zones).toEqual(['facility', 'content', 'summary', 'notes', 'declaration', 'signature']);
    expect(doc.sections.map((s) => s.number)).toEqual(['01', '02', '03', '04', '05', '06']);
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

  it('שנאי: 22 פריטים, 5 בדיקות בידוד, ליקוי נכנס לסיכום', () => {
    const t = transformerInspectionService.createEmpty();
    expect(t.transformers[0].checklist).toHaveLength(22);
    expect(t.transformers[0].insulation).toHaveLength(5);
    t.transformers[0].checklist[0].status = 'bad';
    const doc = renderReportDocument(report('TRANSFORMER_INSPECTION', { typeData: t as unknown as Record<string, unknown> }), null);
    const summary = doc.sections.find((s) => s.zone === 'summary')!;
    expect(JSON.stringify(summary)).toContain('מרחקים תקינים מסביב לשנאי');
  });

  it('normalize שומר שדות לא מוכרים (אין איבוד נתונים מהגרסה הישנה)', () => {
    const n = serviceFor('MAIN_PANEL').normalize({ facilities: [], legacy: {}, someOldField: 42 });
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
