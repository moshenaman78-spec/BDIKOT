/**
 * services/supabaseClient.ts — חיבור יחיד ל-Supabase.
 * טבלאות: reports, clients, projects, company_settings, report_versions; Storage: report-files.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/config';

export const TABLES = {
  reports: 'reports',
  reportVersions: 'report_versions',
  clients: 'clients',
  projects: 'projects',
  companySettings: 'company_settings',
  userProfiles: 'user_profiles',
} as const;

export const BUCKETS = { reportFiles: 'report-files' } as const;

/** RPC אטומי (Postgres SEQUENCE) למספר דוח — קיים כבר בענן. */
export const RPC = { nextReportNumber: 'get_next_report_number' } as const;

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  return client;
}

/** לבדיקות: הזרקת לקוח מדומה. */
export function setSupabaseForTests(c: SupabaseClient | null): void {
  client = c;
}

/**
 * מזהה מכשיר קבוע — נשמר ב-report_data.settings.savedByDevice.
 * אותו מפתח ופורמט כמו getDeviceId() בישן ('rdDeviceId'): /app/ ו-/ באותו דומיין חולקים
 * localStorage, כך שאותו דפדפן נחשב אותו מכשיר בשתי האפליקציות.
 */
export function getDeviceId(): string {
  const KEY = 'rdDeviceId';
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;
    const id = 'dev_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    return 'device-unknown';
  }
}
