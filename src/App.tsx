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
          {/* TODO(foundation): המסכים התחברות / טיוטות / פרטים כלליים / קונפליקט נבנו ב-bdikot-react-foundation.zip — לשלב כאן. */}
          <p className="sh-skeleton-note">🚧 המסך הזה נמצא בחבילת ה-foundation ויחובר כשתועלה לריפו.</p>
        </div>
      )}
    </>
  );
}
