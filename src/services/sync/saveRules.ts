/**
 * services/sync/saveRules.ts — כללי השמירה כפונקציות טהורות (ללא רשת), כדי שיהיו בדיקות.
 *
 * מבוסס 1:1 על saveReportToCloudInner / checkCloudConflict / verifyOpenReportFreshness
 * באפליקציה הישנה (Phase 2A/2B/2C, v2.2.551):
 *   1. זהות קבועה: דוח קיים = UPDATE של אותו UUID. אין INSERT חלופי לעולם.
 *   2. אין יצירה שקטה: INSERT רק כשנלחץ "דוח חדש"/"שמור" במפורש (insertPending=true).
 *   3. מספר דוח קבוע: נקבע פעם אחת ב-INSERT ולא נשלח ב-UPDATE.
 *   4. אין דריסה: UPDATE מותנה WHERE updated_at = הגרסה שהמכשיר מכיר. 0 שורות → קונפליקט.
 *   5. אין ארכוב אוטומטי: שום שמירה לא משנה status של דוח אחר.
 *
 * TODO(foundation): ב-bdikot-react-foundation.zip קיימת ליבת סנכרון עם 35 בדיקות יחידה.
 *   כשהקובץ יועלה לריפו — למזג: להשאיר את הגרסה שם כמקור, ולהעביר לכאן רק מה שחסר.
 */

export interface CloudVersionMeta {
  id: string;
  updated_at: string;
  status: string;
  saved_by_device: string | null;
}

export interface SaveContext {
  cloudReportId: string | null;
  insertPending: boolean;
  /** דוח שנפתח אוטומטית בהפעלה — נוצר בענן רק אחרי שהוזן תוכן. */
  insertRequiresContent: boolean;
  hasMeaningfulContent: boolean;
  online: boolean;
  knownUpdatedAt: string | null;
}

export type SaveDecision =
  | { action: 'blocked-no-identity'; message: string }
  | { action: 'skip-empty' }
  | { action: 'queue-offline' }
  | { action: 'insert' }
  | { action: 'conditional-update'; known: string }
  | { action: 'verify-version-first' };

export function decideSave(ctx: SaveContext): SaveDecision {
  if (!ctx.cloudReportId) {
    return {
      action: 'blocked-no-identity',
      message: 'לדוח הפתוח אין זהות בענן. לחץ "שמור" כדי ליצור אותו במפורש, או "בדיקה חדשה".',
    };
  }
  if (!ctx.online) return { action: 'queue-offline' };
  if (ctx.insertPending) {
    if (ctx.insertRequiresContent && !ctx.hasMeaningfulContent) return { action: 'skip-empty' };
    return { action: 'insert' };
  }
  if (ctx.knownUpdatedAt) return { action: 'conditional-update', known: ctx.knownUpdatedAt };
  return { action: 'verify-version-first' };
}

export type VersionVerdict =
  | { kind: 'adopt'; known: string }
  | { kind: 'conflict' }
  | { kind: 'deleted' }
  | { kind: 'missing' };

const isTombstone = (status: string) => status === 'archived' || status === 'deleted';

/**
 * אין גרסה ידועה (דוח ישן / אחרי INSERT כפול). מאמצים את גרסת הענן רק אם המכשיר הזה
 * הוא האחרון ששמר אותה; אחרת קונפליקט.
 */
export function verdictForUnknownVersion(meta: CloudVersionMeta | null, deviceId: string): VersionVerdict {
  if (!meta) return { kind: 'missing' };
  if (isTombstone(meta.status)) return { kind: 'deleted' };
  if (meta.saved_by_device && meta.saved_by_device === deviceId) return { kind: 'adopt', known: meta.updated_at };
  return { kind: 'conflict' };
}

/** UPDATE מותנה החזיר 0 שורות — מבררים למה, בלי לכתוב כלום. */
export function classifyZeroRowUpdate(meta: CloudVersionMeta | null): 'missing' | 'deleted' | 'conflict' {
  if (!meta) return 'missing';
  if (isTombstone(meta.status)) return 'deleted';
  return 'conflict';
}

export type FreshnessVerdict = 'current' | 'adopt' | 'reload-from-cloud' | 'conflict' | 'missing' | 'tombstone';

/** בפתיחת דוח קיים / חזרה לטאב / חזרת רשת. */
export function decideFreshness(args: {
  meta: CloudVersionMeta | null;
  known: string | null;
  deviceId: string;
  localDirty: boolean;
}): FreshnessVerdict {
  const { meta, known, deviceId, localDirty } = args;
  if (!meta) return 'missing';
  if (isTombstone(meta.status)) return 'tombstone';
  if (known && meta.updated_at === known) return 'current';
  if (!known && meta.saved_by_device && meta.saved_by_device === deviceId) return 'adopt';
  if (known && !localDirty) return 'reload-from-cloud';
  return 'conflict';
}

export function isLocalDirty(editSeq: number, syncedSeq: number): boolean {
  return editSeq > syncedSeq;
}

/** האפשרויות בחלונית הקונפליקט — אף אחת מהן לא כותבת בלי לחיצה מפורשת. */
export const CONFLICT_ACTIONS = [
  { id: 'load-cloud', label: '☁️ טען את גרסת הענן', hint: 'מחליף את מה שרשום כאן בגרסה העדכנית מהענן. השינויים שעשית כאן יאבדו.' },
  { id: 'save-as-copy', label: '📄 שמור את הגרסה שלי כעותק נפרד', hint: 'שומר כדוח חדש ונפרד (מספר חדש), בלי לדרוס את הגרסה בענן.' },
  { id: 'compare', label: '🔍 השווה שינויים', hint: 'מציג אילו שדות שונים. לא משנה ולא שומר כלום.' },
  { id: 'cancel', label: 'ביטול — המשך לערוך, אל תשמור כרגע', hint: '' },
] as const;
export type ConflictActionId = (typeof CONFLICT_ACTIONS)[number]['id'];

/** שדות טכניים שלא מציגים בהשוואה. */
const DIFF_IGNORED = new Set([
  'settings.cloudKnownUpdatedAt', 'settings.cloudEditSeq', 'settings.cloudSyncedSeq', 'settings.savedByDevice',
  'settings.cloudInsertPending', 'settings.cloudInsertRequiresContent',
]);

export interface FieldDiff {
  path: string;
  local: unknown;
  cloud: unknown;
}

/** השוואה עמוקה ל"השווה שינויים" — מחזירה רק עלים שונים. */
export function diffReportData(local: unknown, cloud: unknown, path = '', out: FieldDiff[] = []): FieldDiff[] {
  if (DIFF_IGNORED.has(path)) return out;
  const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
  if (isObj(local) && isObj(cloud)) {
    // פריט אחר באותו מקום ברשימה (שנאי/ממסר/תמונה שהוחלפו או סודרו מחדש) — שינוי אחד, לא שדה-שדה
    if (typeof local.id === 'string' && typeof cloud.id === 'string' && local.id !== cloud.id) {
      out.push({ path, local, cloud });
      return out;
    }
    const keys = new Set([...Object.keys(local), ...Object.keys(cloud)]);
    for (const k of keys) diffReportData(local[k], cloud[k], path ? `${path}.${k}` : k, out);
    return out;
  }
  if (JSON.stringify(local) !== JSON.stringify(cloud)) out.push({ path, local, cloud });
  return out;
}
