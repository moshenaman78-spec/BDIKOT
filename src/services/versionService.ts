/**
 * services/versionService.ts — היסטוריית גרסאות (report_versions).
 *
 * שינוי מכוון לעומת האפליקציה הישנה: restoreReportVersionAsNew שם עשתה UPDATE לא מותנה
 * על reports. כאן השחזור עובר דרך saveReport (UPDATE מותנה) — כך גם שחזור לא דורס
 * עריכה ממכשיר אחר.
 */
import type { ReportData, ReportVersionRow } from '@/core/reportModel';
import { saveReport, type SaveOutcome, type SyncDeps } from './reportSyncService';

export async function createVersion(deps: SyncDeps, data: ReportData): Promise<ReportVersionRow> {
  const id = data.settings.cloudReportId;
  if (!id || data.settings.cloudInsertPending) throw new Error('יש לשמור את הדוח בענן קודם ליצירת גרסה');
  const next = (await deps.store.latestVersionNumber(id)) + 1;
  return deps.store.insertVersion({ report_id: id, version_number: next, report_data: data, created_by: deps.userId });
}

export function listVersions(deps: SyncDeps, reportId: string) {
  return deps.store.listVersions(reportId);
}

/** משחזר גרסה: מחליף את התוכן (UPDATE מותנה) ויוצר גרסה חדשה בסוף הרצף. לא מוחק היסטוריה. */
export async function restoreVersion(
  deps: SyncDeps,
  current: ReportData,
  versionNumber: number,
): Promise<{ outcome: SaveOutcome; data: ReportData }> {
  const id = current.settings.cloudReportId;
  if (!id) return { outcome: { kind: 'blocked', message: 'לדוח אין זהות בענן' }, data: current };
  const v = await deps.store.fetchVersion(id, versionNumber);
  if (!v) return { outcome: { kind: 'error', message: 'הגרסה לא נמצאה' }, data: current };
  // תוכן מהגרסה, זהות וסנכרון מהדוח הנוכחי (מספר דוח לא משתנה)
  const restored: ReportData = {
    ...v.report_data,
    meta: { ...v.report_data.meta, reportNumber: current.meta.reportNumber },
    settings: { ...current.settings },
  };
  const outcome = await saveReport(deps, restored);
  if (outcome.kind === 'saved') await createVersion(deps, restored);
  return { outcome, data: restored };
}
