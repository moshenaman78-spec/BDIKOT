/**
 * services/reportSyncService.ts — שמירה/טעינה של דוח מול הענן לפי כללי השמירה.
 *
 * כל פונקציה מחזירה תוצאה מפורשת (SaveOutcome) — ה-UI מחליט מה להציג (pill/toast/חלונית).
 * שום פונקציה כאן לא יוצרת דוח בשקט, לא דורסת, ולא מארכבת.
 */
import type { ReportData, ReportRow } from '@/core/reportModel';
import { emptyMeta, emptySettings } from '@/core/reportModel';
import { getReportType, reportTypeFromHebrewName, type ReportTypeCode } from '@/core/reportTypes';
import { nextReportNumber, type LocalCounter } from './reportNumber';
import { serviceFor } from './reports/registry';
import { writeTypeData } from './reports/ReportTypeService';
import type { ReportStore, UpdatePatch } from './sync/reportStore';
import {
  classifyZeroRowUpdate, decideFreshness, decideSave, diffReportData, isLocalDirty, verdictForUnknownVersion,
  type FieldDiff, type FreshnessVerdict,
} from './sync/saveRules';

export type SaveOutcome =
  | { kind: 'saved'; updatedAt: string; created: boolean }
  | { kind: 'conflict'; deleted: boolean }
  | { kind: 'missing'; message: string }
  | { kind: 'blocked'; message: string }
  | { kind: 'offline-queued' }
  | { kind: 'skipped-empty' }
  | { kind: 'error'; message: string };

export interface SyncDeps {
  store: ReportStore;
  deviceId: string;
  userId: string;
  online?: () => boolean;
  localCounter?: LocalCounter;
  newId?: () => string;
}

export function typeCodeOf(data: ReportData): ReportTypeCode {
  return reportTypeFromHebrewName(data.settings.formTypeName);
}

/** תוכן משמעותי — חוסם יצירת דוח ריק שנפתח אוטומטית. */
export function hasMeaningfulContent(data: ReportData): boolean {
  const m = data.meta;
  const notes = Array.isArray(data.notes) ? data.notes : [];
  return Boolean(m.client || m.siteName || m.address || m.project || m.description || notes.some((n) => String(n ?? '').trim()));
}

/**
 * "דוח חדש" מפורש: מקצה UUID ומספר דוח מראש. עדיין לא נכתב לענן —
 * ה-INSERT קורה בשמירה הראשונה (insertPending), אידמפוטנטי לפי ה-UUID.
 */
export async function createNewReport(
  deps: SyncDeps,
  code: ReportTypeCode,
  opts: { requireContentBeforeInsert?: boolean; inverterBrand?: string } = {},
): Promise<ReportData> {
  const id = (deps.newId ?? (() => crypto.randomUUID()))();
  const reportNumber = await nextReportNumber(deps.store, code, { inverterBrand: opts.inverterBrand, local: deps.localCounter });
  const settings = emptySettings(getReportType(code).nameHe);
  settings.cloudReportId = id;
  settings.cloudInsertPending = true;
  settings.cloudInsertRequiresContent = !!opts.requireContentBeforeInsert;
  const data: ReportData = {
    meta: { ...emptyMeta(), reportNumber, date: new Date().toISOString().slice(0, 10) },
    settings,
    notes: [''], // כמו newState() בישן
    customDeclaration: '',
    showElectricianDeclaration: true,
    approvalStatus: '',
  };
  const svc = serviceFor(code);
  writeTypeData(svc, data, svc.createEmpty());
  return data;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** שמירה לענן. משנה את data.settings במקום (גרסה ידועה, דגלי insert) — כמו האפליקציה הישנה. */
export async function saveReport(deps: SyncDeps, data: ReportData): Promise<SaveOutcome> {
  const { store, deviceId, userId } = deps;
  const s = data.settings;
  s.savedByDevice = deviceId;
  const decision = decideSave({
    cloudReportId: s.cloudReportId,
    insertPending: s.cloudInsertPending,
    insertRequiresContent: Boolean(s.cloudInsertRequiresContent),
    hasMeaningfulContent: hasMeaningfulContent(data),
    online: deps.online ? deps.online() : true,
    knownUpdatedAt: s.cloudKnownUpdatedAt,
  });

  const id = s.cloudReportId!;
  const editSeqAtStart = s.cloudEditSeq;
  const code = typeCodeOf(data);
  try {
    switch (decision.action) {
      case 'blocked-no-identity':
        return { kind: 'blocked', message: decision.message };
      case 'queue-offline':
        // TODO(offline-queue): לחבר לתור ה-offline של ליבת הסנכרון (foundation zip).
        return { kind: 'offline-queued' };
      case 'skip-empty':
        return { kind: 'skipped-empty' };
      case 'insert': {
        s.cloudInsertRequiresContent = false;
        // המספר עדיין לא "קפוא" (הדוח טרם נוצר) — אם תפוס, מקצים חדש לפני היצירה.
        if (data.meta.reportNumber && (await store.reportNumberTaken(data.meta.reportNumber, id))) {
          data.meta.reportNumber = await nextReportNumber(store, code, { local: deps.localCounter });
        }
        const payloadData = clone(data);
        payloadData.settings.cloudInsertPending = false;
        const res = await store.insert({
          id, project_id: s.cloudProjectId, client_id: s.cloudClientId,
          report_number: data.meta.reportNumber || null, report_type: code,
          report_title: data.meta.siteName || null, status: 'draft',
          inspection_date: data.meta.date || null, report_data: payloadData, created_by: userId,
        });
        s.cloudInsertPending = false;
        if (res.kind === 'inserted') {
          s.cloudKnownUpdatedAt = res.updated_at;
          s.cloudSyncedSeq = editSeqAtStart;
          return { kind: 'saved', updatedAt: res.updated_at, created: true };
        }
        // אותו UUID כבר קיים (ריענון/מירוץ) — זה אותו דוח. ממשיכים כ-UPDATE מותנה.
        s.cloudKnownUpdatedAt = null;
        return saveReport(deps, data);
      }
      case 'verify-version-first': {
        const v = verdictForUnknownVersion(await store.fetchMeta(id), deviceId);
        if (v.kind === 'missing') return missing(id);
        if (v.kind === 'deleted') return { kind: 'conflict', deleted: true };
        if (v.kind === 'conflict') return { kind: 'conflict', deleted: false };
        s.cloudKnownUpdatedAt = v.known;
        return saveReport(deps, data);
      }
      case 'conditional-update': {
        const patch: UpdatePatch = {
          report_type: code,
          report_title: data.meta.siteName || null,
          inspection_date: data.meta.date || null,
          report_data: data,
          ...(s.cloudClientId ? { client_id: s.cloudClientId } : {}),
          ...(s.cloudProjectId ? { project_id: s.cloudProjectId } : {}),
        };
        const newUpdatedAt = await store.conditionalUpdate(id, decision.known, patch);
        if (newUpdatedAt === null) {
          const why = classifyZeroRowUpdate(await store.fetchMeta(id));
          if (why === 'missing') return missing(id);
          return { kind: 'conflict', deleted: why === 'deleted' };
        }
        s.cloudKnownUpdatedAt = newUpdatedAt;
        s.cloudSyncedSeq = editSeqAtStart;
        return { kind: 'saved', updatedAt: newUpdatedAt, created: false };
      }
    }
  } catch (e) {
    return { kind: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}

function missing(id: string): SaveOutcome {
  return { kind: 'missing', message: `הדוח לא נמצא בענן (מזהה ${id.slice(0, 8)}). השמירה נעצרה — לא נוצר דוח חדש. הנתונים שמורים מקומית.` };
}

/** טעינה מהענן — מסמנת את הגרסה הידועה. */
export async function loadReport(store: ReportStore, id: string): Promise<{ row: ReportRow; data: ReportData } | null> {
  const row = await store.fetchReport(id);
  if (!row) return null;
  const data = clone(row.report_data);
  data.settings = { ...emptySettings(data.settings?.formTypeName ?? ''), ...data.settings };
  data.settings.cloudReportId = row.id;
  data.settings.cloudKnownUpdatedAt = row.updated_at;
  data.settings.cloudInsertPending = false;
  data.settings.cloudEditSeq = 0;
  data.settings.cloudSyncedSeq = 0;
  // מוסיפים רק מפתחות שהישנה מכירה, ורק אם חסרים — לא ממציאים מבנה חדש בדוח
  if (!Array.isArray(data.notes)) data.notes = [''];
  data.meta = { ...emptyMeta(), ...data.meta };
  return { row, data };
}

export async function checkFreshness(deps: SyncDeps, data: ReportData): Promise<FreshnessVerdict | 'skip'> {
  const id = data.settings.cloudReportId;
  if (!id || data.settings.cloudInsertPending) return 'skip';
  return decideFreshness({
    meta: await deps.store.fetchMeta(id),
    known: data.settings.cloudKnownUpdatedAt,
    deviceId: deps.deviceId,
    localDirty: isLocalDirty(data.settings.cloudEditSeq, data.settings.cloudSyncedSeq),
  });
}

/* ------------------------- חלונית קונפליקט ------------------------- */

export async function resolveLoadCloud(store: ReportStore, id: string) {
  return loadReport(store, id);
}

/** "שמור כעותק": דוח חדש (UUID ומספר חדשים) עם התוכן המקומי. המקור בענן לא נוגע. */
export async function resolveSaveAsCopy(deps: SyncDeps, local: ReportData): Promise<{ copy: ReportData; outcome: SaveOutcome }> {
  const code = typeCodeOf(local);
  const fresh = await createNewReport(deps, code);
  const copy = clone(local);
  copy.meta.reportNumber = fresh.meta.reportNumber;
  copy.settings = { ...copy.settings, ...fresh.settings, cloudClientId: local.settings.cloudClientId, cloudProjectId: local.settings.cloudProjectId };
  const outcome = await saveReport(deps, copy);
  return { copy, outcome };
}

export async function resolveCompare(store: ReportStore, local: ReportData): Promise<FieldDiff[]> {
  const id = local.settings.cloudReportId;
  if (!id) return [];
  const row = await store.fetchReport(id);
  return row ? diffReportData(local, row.report_data) : [];
}
