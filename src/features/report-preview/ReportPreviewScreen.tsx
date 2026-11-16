/**
 * features/report-preview — בורר 19 סוגי הדוחות (לפי הקטגוריות של האפליקציה הקיימת)
 * + תצוגת המסמך בתבנית החדשה. עובד בלי ענן (נתוני דוגמה), לבדיקת העיצוב וההדפסה.
 */
import { useMemo, useState } from 'react';
import { emptyMeta, emptySettings, type ReportData } from '@/core/reportModel';
import { PICKER_ORDER, REPORT_CATEGORIES, REPORT_TYPES, typesInCategory, type ReportTypeCode } from '@/core/reportTypes';
import { Card, ReportDocumentView, SelectField } from '@/components/report-template';
import { EMPTY_COMPANY } from '@/services/companySettingsService';
import { renderReportDocument, serviceFor, validateReport } from '@/services/reports';

function sampleReport(code: ReportTypeCode): ReportData {
  const svc = serviceFor(code);
  return {
    meta: { ...emptyMeta(), reportNumber: `${REPORT_TYPES[code].numberPrefix}-1000-11-2026`, date: '2026-11-16', client: 'לקוח לדוגמה', siteName: 'אתר לדוגמה', address: 'רחוב הדוגמה 1, תל אביב' },
    settings: emptySettings(REPORT_TYPES[code].nameHe),
    notes: [{ id: 'n1', text: 'יש לתקן את הליקויים ולהזמין בדיקה חוזרת.' }, { id: 'n2', text: 'הבדיקה תקפה למועד ביצועה בלבד.' }],
    summary: 'המתקן נבדק בהתאם לחוק החשמל ותקנותיו.',
    typeData: svc.createEmpty(),
  };
}

export function ReportPreviewScreen() {
  const [code, setCode] = useState<ReportTypeCode>('MAIN_PANEL');
  const data = useMemo(() => sampleReport(code), [code]);
  const doc = useMemo(() => renderReportDocument(data, new Date().toISOString()), [data]);
  const issues = useMemo(() => validateReport(data), [data]);
  const svc = serviceFor(code);
  const byName = Object.fromEntries(PICKER_ORDER.map((c) => [REPORT_TYPES[c].nameHe, c])) as Record<string, ReportTypeCode>;

  return (
    <div className="sh-container">
      <div className="sh-no-print">
        <Card title="סוג דוח" icon="📑">
          <SelectField label="בחר סוג טופס בדיקה" value={REPORT_TYPES[code].nameHe}
            options={PICKER_ORDER.map((c) => REPORT_TYPES[c].nameHe)} onChange={(v) => v && setCode(byName[v])} />
          <details>
            <summary>לפי קטגוריות</summary>
            <ul>{REPORT_CATEGORIES.map((cat) => <li key={cat}><b>{cat}:</b> {typesInCategory(cat).map((c) => REPORT_TYPES[c].nameHe).join(' · ')}</li>)}</ul>
          </details>
          {svc.isSkeleton ? <p className="sh-skeleton-note">🚧 שירות הדוח הזה עדיין שלד — עריכה מלאה באפליקציה הקיימת.</p> : null}
          {issues.length ? <ul>{issues.map((i) => <li key={i.path}>{i.severity === 'error' ? '⛔' : '⚠️'} {i.message}</li>)}</ul> : null}
          <button type="button" className="sh-tab" style={{ color: 'var(--sh-navy)', borderColor: 'var(--sh-sky)' }} onClick={() => window.print()}>🖨️ הדפסה / PDF</button>
        </Card>
      </div>
      <ReportDocumentView doc={doc} company={EMPTY_COMPANY} />
    </div>
  );
}
