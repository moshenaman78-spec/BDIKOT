/**
 * services/sync/reportStore.ts — ממשק אחסון (port) + מימוש Supabase (adapter).
 * השירותים עובדים מול הממשק בלבד, כך שאפשר להריץ בדיקות מול מימוש בזיכרון.
 */
import type { ReportData, ReportRow, ReportVersionRow } from '@/core/reportModel';
import type { CloudVersionMeta } from './saveRules';
import { getSupabase, RPC, TABLES } from '../supabaseClient';

export interface InsertPayload {
  id: string;
  project_id: string | null;
  client_id: string | null;
  report_number: string | null;
  report_type: string;
  report_title: string | null;
  status: 'draft';
  inspection_date: string | null;
  report_data: ReportData;
  created_by: string;
}

/** שים לב: אין report_number ואין status — אלה לא משתנים ב-UPDATE. */
export interface UpdatePatch {
  report_type: string;
  report_title: string | null;
  inspection_date: string | null;
  report_data: ReportData;
  client_id?: string;
  project_id?: string;
}

export type InsertResult = { kind: 'inserted'; updated_at: string } | { kind: 'duplicate' };

export interface DraftListItem {
  id: string;
  report_number: string | null;
  report_type: string | null;
  report_title: string | null;
  status: string;
  updated_at: string;
  client_name: string | null;
  project_name: string | null;
  chapter_count: number;
}

export interface ReportStore {
  fetchMeta(id: string): Promise<CloudVersionMeta | null>;
  fetchReport(id: string): Promise<ReportRow | null>;
  insert(row: InsertPayload): Promise<InsertResult>;
  /** UPDATE ... WHERE id=:id AND updated_at=:known — מחזיר updated_at חדש או null אם 0 שורות. */
  conditionalUpdate(id: string, known: string, patch: UpdatePatch): Promise<string | null>;
  reportNumberTaken(reportNumber: string, excludeId: string): Promise<boolean>;
  /** מונה אטומי מהשרת; null אם לא זמין (נופלים למונה מקומי). */
  nextReportCounter(): Promise<number | null>;
  listDrafts(): Promise<DraftListItem[]>;
  latestVersionNumber(reportId: string): Promise<number>;
  insertVersion(v: Omit<ReportVersionRow, 'id' | 'created_at'>): Promise<ReportVersionRow>;
  listVersions(reportId: string): Promise<Array<Pick<ReportVersionRow, 'id' | 'version_number' | 'created_at' | 'created_by'>>>;
  fetchVersion(reportId: string, versionNumber: number): Promise<ReportVersionRow | null>;
  /** ארכוב — רק מפעולה מפורשת של משתמש. */
  archiveExplicit(id: string, previousStatus: string): Promise<void>;
}

/* ------------------------------ Supabase ------------------------------ */

const META_COLUMNS = 'id, updated_at, status, saved_by_device:report_data->settings->>savedByDevice';

export const supabaseReportStore: ReportStore = {
  async fetchMeta(id) {
    const { data, error } = await getSupabase().from(TABLES.reports).select(META_COLUMNS).eq('id', id).maybeSingle();
    if (error) throw error;
    return (data as unknown as CloudVersionMeta) ?? null;
  },

  async fetchReport(id) {
    const { data, error } = await getSupabase().from(TABLES.reports).select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return (data as ReportRow) ?? null;
  },

  async insert(row) {
    const { data, error } = await getSupabase().from(TABLES.reports).insert(row).select('id, updated_at').single();
    if (error && (error.code === '23505' || /duplicate key/i.test(error.message ?? ''))) return { kind: 'duplicate' };
    if (error) throw error;
    return { kind: 'inserted', updated_at: (data as { updated_at: string }).updated_at };
  },

  async conditionalUpdate(id, known, patch) {
    const { data, error } = await getSupabase()
      .from(TABLES.reports)
      .update(patch)
      .eq('id', id)
      .eq('updated_at', known) // התנאי בצד השרת; הטריגר trg_reports_updated_at מחליף updated_at
      .select('id, updated_at');
    if (error) throw error;
    const rows = (data ?? []) as Array<{ updated_at: string }>;
    return rows.length ? rows[0].updated_at : null;
  },

  async reportNumberTaken(reportNumber, excludeId) {
    const { data, error } = await getSupabase()
      .from(TABLES.reports).select('id').eq('report_number', reportNumber).neq('id', excludeId).limit(1);
    if (error) throw error;
    return !!data && data.length > 0;
  },

  async nextReportCounter() {
    try {
      const { data, error } = await getSupabase().rpc(RPC.nextReportNumber);
      if (error || data === null || data === undefined) return null;
      return Number(data);
    } catch {
      return null;
    }
  },

  async listDrafts() {
    const { data, error } = await getSupabase()
      .from(TABLES.reports)
      .select('id, report_number, report_type, report_title, status, updated_at, report_data, clients(name), projects(name)')
      .eq('status', 'draft')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    type Raw = {
      id: string; report_number: string | null; report_type: string | null; report_title: string | null; status: string;
      updated_at: string; report_data: { reportChapters?: unknown[] } | null;
      clients: { name: string } | null; projects: { name: string } | null;
    };
    return ((data ?? []) as unknown as Raw[]).map((r) => ({
      id: r.id, report_number: r.report_number, report_type: r.report_type, report_title: r.report_title,
      status: r.status, updated_at: r.updated_at,
      client_name: r.clients?.name ?? null, project_name: r.projects?.name ?? null,
      chapter_count: Array.isArray(r.report_data?.reportChapters) ? r.report_data!.reportChapters!.length : 0,
    }));
  },

  async latestVersionNumber(reportId) {
    const { data, error } = await getSupabase()
      .from(TABLES.reportVersions).select('version_number').eq('report_id', reportId)
      .order('version_number', { ascending: false }).limit(1);
    if (error) throw error;
    return data && data.length ? (data[0] as { version_number: number }).version_number : 0;
  },

  async insertVersion(v) {
    const { data, error } = await getSupabase().from(TABLES.reportVersions).insert(v).select().single();
    if (error) throw error;
    return data as ReportVersionRow;
  },

  async listVersions(reportId) {
    const { data, error } = await getSupabase()
      .from(TABLES.reportVersions).select('id, version_number, created_at, created_by')
      .eq('report_id', reportId).order('version_number', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Array<Pick<ReportVersionRow, 'id' | 'version_number' | 'created_at' | 'created_by'>>;
  },

  async fetchVersion(reportId, versionNumber) {
    const { data, error } = await getSupabase()
      .from(TABLES.reportVersions).select('*').eq('report_id', reportId).eq('version_number', versionNumber).maybeSingle();
    if (error) throw error;
    return (data as ReportVersionRow) ?? null;
  },

  async archiveExplicit(id, previousStatus) {
    const { error } = await getSupabase()
      .from(TABLES.reports)
      .update({ status: 'archived', deleted_at: new Date().toISOString(), previous_status: previousStatus })
      .eq('id', id);
    if (error) throw error;
  },
};
