/**
 * services/sync/editorRules.ts — החלטות של העורך בעבודה מרובת משתמשים, כפונקציות טהורות.
 */
import type { CloudVersionMeta } from './saveRules';

export const AUTOSAVE_DEBOUNCE_MS = 5000; // כמו בישן
export const AUTOSAVE_MAX_WAIT_MS = 30000; // הקלדה רציפה לא דוחה שמירה לנצח
export const FRESHNESS_POLL_MS = 45000; // בדיקה שקטה אם מישהו אחר שמר
export const PRESENCE_WINDOW_MS = 15 * 60 * 1000;

export interface AutosaveInput {
  online: boolean; // יש deps (מחובר לענן)
  hasCloudIdentity: boolean;
  dirty: boolean;
  conflictOpen: boolean;
  /** המשתמש סגר חלונית קונפליקט ב"ביטול" — עד לחיצה על "שמור" לא שומרים אוטומטית. */
  paused: boolean;
}

export function shouldAutosave(i: AutosaveInput): boolean {
  return i.online && i.hasCloudIdentity && i.dirty && !i.conflictOpen && !i.paused;
}

/** כמה לחכות לשמירה האוטומטית: 5 שנ׳ מהעריכה האחרונה, אבל לא יותר מ-30 שנ׳ מהעריכה הראשונה שלא נשמרה. */
export function autosaveDelay(now: number, dirtySince: number | null): number {
  if (dirtySince === null) return AUTOSAVE_DEBOUNCE_MS;
  return Math.max(0, Math.min(AUTOSAVE_DEBOUNCE_MS, dirtySince + AUTOSAVE_MAX_WAIT_MS - now));
}

/**
 * אזהרה רכה בפתיחת דוח: אם מכשיר אחר שמר אותו בדקות האחרונות — ייתכן שבודק אחר עובד עליו עכשיו.
 * (אין נעילה — כללי השמירה מגינים מדריסה; זו רק התראה מוקדמת.)
 */
export function presenceWarning(meta: CloudVersionMeta | null, deviceId: string, now: number): string | null {
  if (!meta || !meta.saved_by_device || meta.saved_by_device === deviceId) return null;
  const t = Date.parse(meta.updated_at);
  if (Number.isNaN(t) || now - t > PRESENCE_WINDOW_MS || now - t < 0) return null;
  const mins = Math.max(1, Math.round((now - t) / 60000));
  return `הדוח נשמר ממכשיר אחר לפני ${mins} דק׳ — ייתכן שבודק אחר עובד עליו עכשיו. אם שניכם תשמרו, תופיע חלונית השוואה ושום דבר לא יידרס.`;
}

/** תאריך מקומי YYYY-MM-DD (לא UTC — אחרי חצות בישראל toISOString מחזיר את אתמול). */
export function localIsoDate(d: Date = new Date()): string {
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
