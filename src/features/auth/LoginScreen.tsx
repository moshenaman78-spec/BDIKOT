/**
 * features/auth/LoginScreen.tsx — התחברות באימייל וסיסמה (אותו חשבון כמו באפליקציה הקיימת).
 */
import { useState } from 'react';
import { Card, Field } from '@/components/report-template';
import { LEGACY_APP_URL } from '@/config';

export function LoginScreen({ onSignIn, onDemo }: { onSignIn: (email: string, password: string) => Promise<string | null>; onDemo: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) { setError('יש להזין אימייל וסיסמה'); return; }
    setBusy(true); setError('');
    const err = await onSignIn(email, password);
    setBusy(false);
    if (err) setError(err);
  };
  return (
    <div className="sh-container sh-login">
      <Card title="התחברות" icon="🔐">
        <form onSubmit={submit} noValidate>
          <p className="sh-dim">אותו אימייל וסיסמה כמו באפליקציית הדוחות הקיימת.</p>
          <Field label="אימייל" type="email" value={email} onChange={setEmail} placeholder="name@example.com" />
          <Field label="סיסמה" type="password" value={password} onChange={setPassword} />
          {error ? <p className="sh-skeleton-note" role="alert">{error}</p> : null}
          <div className="sh-actions">
            <button type="submit" className="sh-btn sh-btn--primary" disabled={busy}>{busy ? 'מתחבר…' : 'התחבר'}</button>
            <button type="button" className="sh-btn" onClick={onDemo}>🧪 הדגמה בלי התחברות</button>
          </div>
          <p className="sh-dim">שכחת סיסמה או צריך משתמש חדש? <a href={LEGACY_APP_URL} target="_blank" rel="noopener">באפליקציה הקיימת</a> (אותו חשבון).</p>
        </form>
      </Card>
    </div>
  );
}
