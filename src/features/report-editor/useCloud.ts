/**
 * features/report-editor/useCloud.ts — מצב החיבור לענן (התחברות / התנתקות), לכל האפליקציה.
 *
 * באותו דומיין כמו האפליקציה הקיימת (/app/ ליד /) ההתחברות משותפת (אותו מפתח אחסון של supabase-js).
 * ב-Preview של Vercel (דומיין אחר) — מתחברים כאן, במסך ההתחברות, עם אותו אימייל וסיסמה.
 */
import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { OFFLINE_DEMO } from '@/config';
import { getDeviceId, getSupabase } from '@/services/supabaseClient';
import { supabaseReportStore } from '@/services/sync/reportStore';
import type { SyncDeps } from '@/services/reportSyncService';

export type CloudState =
  | { status: 'off'; reason: string }
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'ready'; userId: string; email: string | null };

export function cloudConfigured(): boolean {
  return !OFFLINE_DEMO;
}

/** הודעות השגיאה של Supabase Auth בעברית. */
export function authErrorText(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'אימייל או סיסמה שגויים';
  if (/email not confirmed/i.test(message)) return 'כתובת האימייל עדיין לא אושרה — בדוק את תיבת הדואר';
  if (/rate limit|too many/i.test(message)) return 'יותר מדי ניסיונות — נסה שוב בעוד כמה דקות';
  if (/failed to fetch|network/i.test(message)) return 'אין חיבור לשרת — בדוק את האינטרנט ונסה שוב';
  return message;
}

interface CloudApi {
  cloud: CloudState;
  deps: SyncDeps | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const CloudContext = createContext<CloudApi | null>(null);

function useCloudState(): CloudApi {
  const [cloud, setCloud] = useState<CloudState>(() =>
    cloudConfigured() ? { status: 'loading' } : { status: 'off', reason: 'מצב הדגמה בלבד (VITE_OFFLINE_DEMO) — ללא שמירה לענן.' },
  );

  useEffect(() => {
    if (!cloudConfigured()) return;
    const sb = getSupabase();
    // רענון טוקן (כל שעה) מחזיר אותו משתמש — לא מחליפים את האובייקט, כדי שהעורך לא "יתחיל מחדש"
    const apply = (session: { user: { id: string; email?: string | null } } | null) =>
      setCloud((prev) => {
        if (!session) return prev.status === 'signed-out' ? prev : { status: 'signed-out' };
        if (prev.status === 'ready' && prev.userId === session.user.id) return prev;
        return { status: 'ready', userId: session.user.id, email: session.user.email ?? null };
      });
    sb.auth.getSession().then(({ data }) => apply(data.session)).catch(() => apply(null));
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => apply(session));
    return () => sub.subscription.unsubscribe();
  }, []);

  const deps = useMemo<SyncDeps | null>(() => {
    if (cloud.status !== 'ready') return null;
    return { store: supabaseReportStore, deviceId: getDeviceId(), userId: cloud.userId, online: () => navigator.onLine !== false };
  }, [cloud]);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
      return error ? authErrorText(error.message) : null;
    } catch (e) {
      return authErrorText(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const signOut = useCallback(async () => {
    try { await getSupabase().auth.signOut({ scope: 'local' }); } catch { /* */ }
  }, []);

  return { cloud, deps, signIn, signOut };
}

export function CloudProvider({ children }: { children: ReactNode }) {
  return createElement(CloudContext.Provider, { value: useCloudState() }, children);
}

/** בתוך CloudProvider — המצב המשותף; מחוץ לו (בדיקות/מסך בודד) — מצב עצמאי. */
export function useCloud(): CloudApi {
  const ctx = useContext(CloudContext);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return ctx ?? useCloudState();
}
