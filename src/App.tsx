import { useState } from 'react';
import { AppHeader, TabBar, type TabDef } from '@/components/report-template';
import { ReportPreviewScreen } from '@/features/report-preview/ReportPreviewScreen';
import { ReportScreen } from '@/features/report-screen/ReportScreen';
import { LoginScreen } from '@/features/auth/LoginScreen';
import { CloudProvider, useCloud } from '@/features/report-editor/useCloud';
import { APP_VERSION, LEGACY_APP_URL } from '@/config';

type TabKey = 'reports' | 'preview' | 'legacy';
const TABS: TabDef<TabKey>[] = [
  { key: 'reports', label: 'דוחות', icon: '📁' },
  { key: 'preview', label: 'תבנית דוח', icon: '📄' },
  { key: 'legacy', label: 'לקוחות והגדרות', icon: '⚙️' },
];

function Shell() {
  const { cloud, signIn, signOut } = useCloud();
  const [tab, setTab] = useState<TabKey>('reports');
  const [demo, setDemo] = useState(false);
  const signedIn = cloud.status === 'ready';
  const status = cloud.status === 'ready'
    ? <span className="sh-user">👤 {cloud.email} <button type="button" className="sh-link" onClick={() => { if (window.confirm('להתנתק? שינויים שלא נשמרו בענן נשארים שמורים במכשיר.')) void signOut(); }}>התנתק</button></span>
    : cloud.status === 'loading' ? 'מתחבר…' : demo || cloud.status === 'off' ? 'מצב הדגמה' : null;

  const needsLogin = cloud.status === 'signed-out' && !demo;
  return (
    <>
      <AppHeader title="Shaked Test Reports" status={status}>
        {needsLogin || cloud.status === 'loading' ? null : <TabBar tabs={TABS} active={tab} onChange={setTab} />}
      </AppHeader>
      {cloud.status === 'loading' ? <div className="sh-container"><p className="sh-dim" role="status">מתחבר…</p></div>
        : needsLogin ? <LoginScreen onSignIn={signIn} onDemo={() => setDemo(true)} />
          : tab === 'reports' ? <ReportScreen key={signedIn ? 'cloud' : 'demo'} />
            : tab === 'preview' ? <ReportPreviewScreen />
              : (
                <div className="sh-container">
                  <section className="sh-card">
                    <div className="sh-card__head"><h2 className="sh-card__title">לקוחות, הגדרות חברה ושאר סוגי הדוחות</h2></div>
                    <div className="sh-card__body">
                      <p>המסכים האלה עדיין לא הועברו לאפליקציה החדשה. בינתיים עובדים בהם באפליקציה הקיימת — אותו חשבון ואותם נתונים.</p>
                      <p className="sh-dim">דוחות "שנאי מתח גבוה" ו"לוח חשמל ראשי" כבר נערכים כאן (לשונית "דוחות"). הגדרות החברה (לוגו, חתימה, פרטי בודק) נקראות מהענן ומופיעות בדוחות כאן.</p>
                      <a className="sh-btn sh-btn--primary" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }} href={LEGACY_APP_URL} target="_blank" rel="noopener">פתח את האפליקציה הקיימת ↗</a>
                    </div>
                  </section>
                </div>
              )}
      <div className="sh-version sh-no-print">גרסה <bdi dir="ltr">{APP_VERSION}</bdi></div>
    </>
  );
}

export function App() {
  return <CloudProvider><Shell /></CloudProvider>;
}
