/**
 * features/report-editor/useCloud.ts — מצב החיבור לענן.
 *
 * /app/ ו-/ באותו דומיין, ושתיהן משתמשות ב-supabase-js v2 עם מפתח האחסון ברירת המחדל
 * (sb-<project>-auth-token) — לכן התחברות באפליקציה הקיימת תקפה גם כאן. מסך התחברות
 * ייעודי נמצא בחבילת ה-foundation (TODO לשלב).
 */
import { useEffect, useMemo, useState } from 'react';
import { getDeviceId, getSupabase } from '@/services/supabaseClient';
import { supabaseReportStore } from '@/services/sync/reportStore';
import type { SyncDeps } from '@/services/reportSyncService';

export type CloudState =
  | { status: 'off'; reason: string }
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'ready'; userId: string; email: string | null };

export function cloudConfigured(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

export function useCloud(): { cloud: CloudState; deps: SyncDeps | null } {
  const [cloud, setCloud] = useState<CloudState>(() =>
    cloudConfigured() ? { status: 'loading' } : { status: 'off', reason: 'אין הגדרות Supabase (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) — מצב הדגמה מקומי, ללא שמירה לענן.' },
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
    sb.auth.getSession().then(({ data }) => apply(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => apply(session));
    return () => sub.subscription.unsubscribe();
  }, []);

  const deps = useMemo<SyncDeps | null>(() => {
    if (cloud.status !== 'ready') return null;
    return { store: supabaseReportStore, deviceId: getDeviceId(), userId: cloud.userId, online: () => navigator.onLine !== false };
  }, [cloud]);

  return { cloud, deps };
}
