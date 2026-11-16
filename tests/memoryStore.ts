/** ReportStore בזיכרון שמחקה את Supabase: UPDATE מותנה ב-updated_at, טריגר שמחליף updated_at. */
import type { ReportRow, ReportVersionRow } from '@/core/reportModel';
import type { ReportStore } from '@/services/sync/reportStore';

export function memoryStore(opts: { counter?: number | null } = {}) {
  const rows = new Map<string, ReportRow>();
  const versions: ReportVersionRow[] = [];
  let clock = Date.parse('2026-11-16T10:00:00Z');
  let counter = opts.counter === undefined ? 1000 : opts.counter;
  const tick = () => new Date((clock += 1000)).toISOString();
  const calls = { insert: 0, update: 0, archive: 0 };

  const store: ReportStore = {
    async fetchMeta(id) {
      const r = rows.get(id);
      return r ? { id, updated_at: r.updated_at, status: r.status, saved_by_device: (r.report_data.settings.savedByDevice as string) ?? null } : null;
    },
    async fetchReport(id) { const r = rows.get(id); return r ? structuredClone(r) : null; },
    async insert(p) {
      calls.insert++;
      if (rows.has(p.id)) return { kind: 'duplicate' };
      const now = tick();
      rows.set(p.id, { ...structuredClone(p), created_at: now, updated_at: now, deleted_at: null, previous_status: null });
      return { kind: 'inserted', updated_at: now };
    },
    async conditionalUpdate(id, known, patch) {
      calls.update++;
      const r = rows.get(id);
      if (!r || r.updated_at !== known) return null;
      const now = tick();
      rows.set(id, { ...r, ...structuredClone(patch), updated_at: now });
      return now;
    },
    async reportNumberTaken(n, ex) { return [...rows.values()].some((r) => r.report_number === n && r.id !== ex); },
    async nextReportCounter() { return counter === null ? null : counter++; },
    async listDrafts() { return []; },
    async latestVersionNumber(id) { return Math.max(0, ...versions.filter((v) => v.report_id === id).map((v) => v.version_number)); },
    async insertVersion(v) { const row = { ...structuredClone(v), id: `v${versions.length}`, created_at: tick() }; versions.push(row); return row; },
    async listVersions(id) { return versions.filter((v) => v.report_id === id); },
    async fetchVersion(id, n) { return versions.find((v) => v.report_id === id && v.version_number === n) ?? null; },
    async archiveExplicit(id) { calls.archive++; const r = rows.get(id); if (r) rows.set(id, { ...r, status: 'archived' }); },
  };
  /** מדמה שמירה ממכשיר אחר. */
  const touchFromOtherDevice = (id: string) => { const r = rows.get(id)!; r.updated_at = tick(); r.report_data.settings.savedByDevice = 'other-device'; };
  return { store, rows, versions, calls, touchFromOtherDevice };
}
