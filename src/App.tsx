import { useState } from 'react';
import { AppHeader, TabBar, type TabDef } from '@/components/report-template';
import { ReportPreviewScreen } from '@/features/report-preview/ReportPreviewScreen';
import { TransformerInspectionScreen } from '@/features/reports/TRANSFORMER_INSPECTION/TransformerInspectionScreen';

type TabKey = 'transformer' | 'preview' | 'drafts' | 'clients' | 'settings';
const TABS: TabDef<TabKey>[] = [
  { key: 'transformer', label: 'שנאי מתח גבוה', icon: '🔋' },
  { key: 'preview', label: 'תבנית דוח', icon: '📄' },
  { key: 'drafts', label: 'טיוטות בענן', icon: '📁' },
  { key: 'clients', label: 'לקוחות', icon: '🗂️' },
  { key: 'settings', label: 'הגדרות חברה', icon: '⚙️' },
];

export function App() {
  const [tab, setTab] = useState<TabKey>('transformer');
  return (
    <>
      <AppHeader title="Shaked Test Reports">
        <TabBar tabs={TABS} active={tab} onChange={setTab} />
      </AppHeader>
      {tab === 'transformer' ? <TransformerInspectionScreen /> : tab === 'preview' ? <ReportPreviewScreen /> : (
        <div className="sh-container">
          {/* TODO(foundation): המסכים התחברות / טיוטות / פרטים כלליים נבנו ב-bdikot-react-foundation.zip — לשלב כאן. */}
          <section className="sh-card">
            <div className="sh-card__head"><h2 className="sh-card__title">{TABS.find((t) => t.key === tab)?.label}</h2></div>
            <div className="sh-card__body">
              <p>המסך הזה עדיין לא הועבר לאפליקציה החדשה. בינתיים עובדים בו באפליקציה הקיימת — אותו חשבון ואותם נתונים.</p>
              <p className="sh-dim">דוחות שנאי מתח גבוה כבר נערכים כאן (לשונית "שנאי מתח גבוה"), כולל הטיוטות שלהם.</p>
              <a className="sh-btn sh-btn--primary" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }} href="/">פתח את האפליקציה הקיימת ↗</a>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
