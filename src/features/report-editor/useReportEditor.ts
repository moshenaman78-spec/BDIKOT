/**
 * features/report-editor/useReportEditor.ts — ניהול דוח פתוח בעורך (לכל סוגי הדוחות).
 *
 * - mutate(): כל עריכה מעלה settings.cloudEditSeq (כמו בישן) — כך יודעים אם יש שינויים שלא נשמרו.
 * - שמירה אוטומטית: 5 שנ׳ אחרי העריכה האחרונה, ולא יותר מ-30 שנ׳ מהעריכה הראשונה שלא נשמרה.
 * - גיבוי מקומי לכל עריכה (מפתח נפרד מזה של האפליקציה הישנה — לא דורס את inspection-current).
 * - עבודה מרובת משתמשים:
 *   · בדיקת עדכניות בחזרה לטאב, בחזרת רשת, ובכל 45 שנ׳: בענן גרסה חדשה ואין כאן שינויים → נטענת;
 *     יש כאן שינויים → חלונית קונפליקט מיד (לא רק בשמירה הבאה).
 *   · "ביטול" בחלונית — השמירה האוטומטית מושהית עד לחיצה על "שמור" (לא נפתחת שוב ושוב כל 5 שנ׳).
 *   · שמירה בלי שינויים לא נשלחת (לא מעדכנת updated_at ולא יוצרת קונפליקט מיותר אצל אחרים).
 *   · "טען גרסת ענן" — הגרסה המקומית שנדחתה נשמרת בגיבוי נפרד במכשיר.
 *   · אזהרה בסגירת הטאב כשיש שינויים שלא הגיעו לענן.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReportData } from '@/core/reportModel';
import {
  loadReport, resolveCompare, resolveSaveAsCopy, saveReport, type SaveOutcome, type SyncDeps,
} from '@/services/reportSyncService';
import { decideFreshness, isLocalDirty, type ConflictActionId, type FieldDiff } from '@/services/sync/saveRules';
import { FRESHNESS_POLL_MS, autosaveDelay, presenceWarning, shouldAutosave } from '@/services/sync/editorRules';

export const AUTOSAVE_MS = 5000;
const BACKUP_PREFIX = 'app-report-backup:';
const DISCARDED_PREFIX = 'app-report-discarded:';

export function backupKey(data: ReportData): string | null {
  return data.settings.cloudReportId ? BACKUP_PREFIX + data.settings.cloudReportId : null;
}

/**
 * עותק לגיבוי מקומי: תמונה שכבר בענן נשמרת בלי dataUrl (כמו sanitizeStateForLocalSave בישן) —
 * אחרת דוח עם כמה תמונות עובר את מגבלת ה-localStorage (~5MB) והגיבוי נכשל בשקט.
 */
export function backupSnapshot(data: ReportData): ReportData {
  const photos = data.generalPhotos;
  if (!Array.isArray(photos)) return data;
  return { ...data, generalPhotos: photos.map((p) => (p && typeof p === 'object' && (p as { cloudPath?: string }).cloudPath ? { ...p, dataUrl: '' } : p)) };
}

/** true = נשמר; false = האחסון המקומי מלא. */
export function writeBackup(data: ReportData): boolean {
  const key = backupKey(data);
  if (!key) return true;
  try { localStorage.setItem(key, JSON.stringify(backupSnapshot(data))); return true; } catch { return false; }
}

const BACKUP_THROTTLE_MS = 700;

export function readBackup(reportId: string): ReportData | null {
  try {
    const raw = localStorage.getItem(BACKUP_PREFIX + reportId);
    return raw ? (JSON.parse(raw) as ReportData) : null;
  } catch {
    return null;
  }
}

function removeBackup(reportId: string): void {
  try { localStorage.removeItem(BACKUP_PREFIX + reportId); } catch { /* */ }
}

/** הגרסה המקומית שהמשתמש בחר לוותר עליה ("טען גרסת ענן") — נשמרת למקרה של טעות. */
export function writeDiscarded(data: ReportData): void {
  const id = data.settings.cloudReportId;
  if (!id) return;
  try { localStorage.setItem(DISCARDED_PREFIX + id, JSON.stringify({ discardedAt: new Date().toISOString(), data })); } catch { /* */ }
}

export function isDirty(d: ReportData): boolean {
  return isLocalDirty(d.settings.cloudEditSeq || 0, d.settings.cloudSyncedSeq || 0) || Boolean(d.settings.cloudInsertPending);
}

/** מחזיר עותק מעודכן עם שדות הסנכרון מהעותק שנשמר, בלי לאבד עריכות שנעשו בזמן השמירה. */
export function applySyncResult(current: ReportData, saved: ReportData): ReportData {
  const s = saved.settings;
  return {
    ...current,
    meta: { ...current.meta, reportNumber: saved.meta.reportNumber },
    settings: {
      ...current.settings,
      cloudReportId: s.cloudReportId,
      cloudKnownUpdatedAt: s.cloudKnownUpdatedAt,
      cloudInsertPending: s.cloudInsertPending,
      cloudInsertRequiresContent: s.cloudInsertRequiresContent,
      cloudSyncedSeq: s.cloudSyncedSeq,
      savedByDevice: s.savedByDevice,
    },
  };
}

export interface StatusContext { dirty: boolean; signedOut: boolean; paused: boolean; online: boolean; inCloud?: boolean }

export function outcomeText(o: SaveOutcome | null, ctx: StatusContext | boolean): string {
  const c: StatusContext = typeof ctx === 'boolean' ? { dirty: ctx, signedOut: false, paused: false, online: true } : ctx;
  if (c.paused) return 'קונפליקט פתוח — השמירה האוטומטית מושהית. לחץ "שמור" כדי לבחור מה לעשות';
  if (c.signedOut) return c.dirty ? 'לא מחובר לענן — השינויים שמורים במכשיר בלבד' : 'לא מחובר לענן';
  if (!c.online && c.dirty) return 'אין חיבור — השינויים שמורים במכשיר ויישלחו כשהחיבור יחזור';
  if (!o) return c.dirty ? 'יש שינויים שלא נשמרו' : c.inCloud ? 'שמור בענן ✓' : 'לא נשמר עדיין';
  switch (o.kind) {
    case 'saved': return c.dirty ? 'יש שינויים חדשים שלא נשמרו' : o.created ? 'נוצר ונשמר בענן ✓' : 'נשמר בענן ✓';
    case 'conflict': return o.deleted ? 'הדוח נמחק/אורכב בענן — לא נשמר' : 'קונפליקט — לא נשמר בענן';
    case 'missing': case 'blocked': case 'error': return o.message;
    case 'offline-queued': return 'אין חיבור — נשמר מקומית';
    case 'skipped-empty': return 'דוח ריק — ייווצר בענן כשיוזן תוכן';
  }
}

export interface ConflictState { deleted: boolean; diff: FieldDiff[] | null; busy: boolean }

export function useReportEditor(initial: ReportData, deps: SyncDeps | null, opts: { onSaved?: (o: SaveOutcome) => void } = {}) {
  const [data, setData] = useState<ReportData>(initial);
  const [saving, setSaving] = useState(false);
  const [outcome, setOutcome] = useState<SaveOutcome | null>(null);
  const [conflict, setConflict] = useState<ConflictState | null>(null);
  const [paused, setPaused] = useState(false);
  const [presence, setPresence] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  const dataRef = useRef(data);
  dataRef.current = data;
  const savingRef = useRef(false);
  const conflictRef = useRef(conflict);
  conflictRef.current = conflict;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const dirtySinceRef = useRef<number | null>(null);
  const onSavedRef = useRef(opts.onSaved);
  onSavedRef.current = opts.onSaved;
  const backupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backupWarned = useRef(false);

  /** גיבוי מקומי — לא בכל הקשה (JSON של כל הדוח), אלא 0.7 שנ׳ אחרי העריכה האחרונה. */
  const flushBackup = useCallback(() => {
    if (backupTimer.current) { clearTimeout(backupTimer.current); backupTimer.current = null; }
    if (!writeBackup(dataRef.current) && !backupWarned.current) {
      backupWarned.current = true;
      setToast('האחסון המקומי במכשיר מלא — אין גיבוי מקומי לשינויים. שמור לענן בהקדם.');
    }
  }, []);
  const scheduleBackup = useCallback(() => {
    if (backupTimer.current) clearTimeout(backupTimer.current);
    backupTimer.current = setTimeout(flushBackup, BACKUP_THROTTLE_MS);
  }, [flushBackup]);
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flushBackup(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flushBackup);
    return () => { document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', flushBackup); flushBackup(); };
  }, [flushBackup]);

  useEffect(() => { setData(initial); setOutcome(null); setConflict(null); setPaused(false); setPresence(null); dirtySinceRef.current = null; }, [initial]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }, [toast]);

  const mutate = useCallback((fn: (draft: ReportData) => void) => {
    if (dirtySinceRef.current === null) dirtySinceRef.current = Date.now();
    setData((cur) => {
      const draft = structuredClone(cur);
      fn(draft);
      draft.settings.cloudEditSeq = (draft.settings.cloudEditSeq || 0) + 1;
      dataRef.current = draft;
      return draft;
    });
    scheduleBackup();
  }, [scheduleBackup]);

  const raiseConflict = useCallback((deleted: boolean) => {
    setPaused(false);
    setConflict({ deleted, diff: null, busy: false });
  }, []);

  const runSave = useCallback(async (explicit: boolean): Promise<SaveOutcome | null> => {
    if (!deps || savingRef.current) return null;
    if (!explicit && (pausedRef.current || conflictRef.current)) return null;
    if (explicit && !isDirty(dataRef.current)) { setToast('אין שינויים חדשים לשמירה'); return null; }
    savingRef.current = true;
    setSaving(true);
    const snapshot = structuredClone(dataRef.current);
    try {
      const o = await saveReport(deps, snapshot);
      setOutcome(o);
      if (o.kind === 'saved') {
        const next = applySyncResult(dataRef.current, snapshot);
        dataRef.current = next;
        if (!isDirty(next)) dirtySinceRef.current = null;
        setPaused(false);
        setData((cur) => { const n = applySyncResult(cur, snapshot); writeBackup(n); return n; });
        onSavedRef.current?.(o);
      } else if (o.kind === 'conflict') raiseConflict(o.deleted);
      return o;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [deps, raiseConflict]);

  const save = useCallback(() => runSave(true), [runSave]);

  const dirty = isDirty(data);

  // שמירה אוטומטית
  useEffect(() => {
    if (!shouldAutosave({ online: !!deps && online, hasCloudIdentity: !!data.settings.cloudReportId, dirty, conflictOpen: !!conflict, paused })) return;
    const t = setTimeout(() => { void runSave(false); }, autosaveDelay(Date.now(), dirtySinceRef.current));
    return () => clearTimeout(t);
  }, [data, deps, online, conflict, paused, dirty, runSave]);

  /** בדיקת עדכניות מול הענן — קריאה בלבד, אלא אם יש מה לשמור. */
  const checkFreshness = useCallback(async (opts2: { withPresence?: boolean } = {}) => {
    const cur = dataRef.current;
    const id = cur.settings.cloudReportId;
    if (!deps || !id || cur.settings.cloudInsertPending || savingRef.current || conflictRef.current) return;
    let meta;
    try { meta = await deps.store.fetchMeta(id); } catch { return; }
    const now = dataRef.current;
    if (now.settings.cloudReportId !== id || savingRef.current || conflictRef.current) return;
    if (opts2.withPresence) setPresence(presenceWarning(meta, deps.deviceId, Date.now()));
    const verdict = decideFreshness({ meta, known: now.settings.cloudKnownUpdatedAt, deviceId: deps.deviceId, localDirty: isDirty(now) });
    if (verdict === 'reload-from-cloud') {
      const loaded = await loadReport(deps.store, id);
      if (loaded && !isDirty(dataRef.current)) {
        setData(loaded.data); writeBackup(loaded.data); setOutcome(null);
        setToast('הדוח עודכן במכשיר אחר — נטענה הגרסה העדכנית');
      }
    } else if (verdict === 'conflict') {
      if (!pausedRef.current) raiseConflict(false);
    } else if (verdict === 'tombstone') {
      raiseConflict(true);
    } else if (verdict === 'adopt' && meta) {
      setData((d) => ({ ...d, settings: { ...d.settings, cloudKnownUpdatedAt: meta!.updated_at } }));
    } else if (verdict === 'missing') {
      setToast('הדוח לא נמצא בענן. השינויים שמורים במכשיר — לא נוצר דוח חדש.');
    }
  }, [deps, raiseConflict]);

  // בפתיחה: עדכניות + אזהרת "בודק אחר עובד עכשיו"
  useEffect(() => { void checkFreshness({ withPresence: true }); }, [initial, deps, checkFreshness]);

  // חזרה לטאב / חזרת רשת / סקר תקופתי
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onVisible = () => { if (document.visibilityState === 'visible') void checkFreshness(); };
    const onOnline = () => { setOnline(true); void checkFreshness().then(() => { if (isDirty(dataRef.current)) void runSave(false); }); };
    const onOffline = () => setOnline(false);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    const poll = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void checkFreshness().then(() => {
        // שמירה שנכשלה (רשת) — ניסיון חוזר גם בלי עריכה חדשה
        if (isDirty(dataRef.current) && !pausedRef.current) void runSave(false);
      });
    }, FRESHNESS_POLL_MS);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      clearInterval(poll);
    };
  }, [checkFreshness, runSave]);

  // אזהרה בסגירת הטאב כשיש שינויים שלא הגיעו לענן (הם בגיבוי המקומי, אבל לא אצל אחרים)
  useEffect(() => {
    if (!data.settings.cloudReportId || !dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty, data.settings.cloudReportId]);

  const resolveConflict = useCallback(async (action: ConflictActionId) => {
    if (!deps || !conflict) return;
    if (action === 'cancel') { setConflict(null); setPaused(true); return; }
    setConflict({ ...conflict, busy: true });
    try {
      const cur = dataRef.current;
      if (action === 'compare') {
        const diff = await resolveCompare(deps.store, cur);
        setConflict({ ...conflict, diff, busy: false });
        return;
      }
      if (action === 'load-cloud') {
        const loaded = await loadReport(deps.store, cur.settings.cloudReportId!);
        if (loaded) {
          if (isDirty(cur)) writeDiscarded(cur);
          setData(loaded.data); writeBackup(loaded.data); setOutcome(null); dirtySinceRef.current = null;
          setToast('נטענה גרסת הענן (הגרסה שלך נשמרה כגיבוי במכשיר)');
        }
        setConflict(null); setPaused(false);
        return;
      }
      if (action === 'save-as-copy') {
        const originalId = cur.settings.cloudReportId;
        const { copy, outcome: o } = await resolveSaveAsCopy(deps, cur);
        setOutcome(o);
        if (o.kind === 'saved') {
          // השינויים עברו לעותק — הגיבוי של המקור כבר לא "שינויים שלא נשמרו"
          if (originalId && originalId !== copy.settings.cloudReportId) removeBackup(originalId);
          setData(copy); writeBackup(copy); dirtySinceRef.current = null;
          setToast(`נשמר כעותק נפרד — מספר ${copy.meta.reportNumber}`);
          setConflict(null); setPaused(false);
        } else setConflict({ ...conflict, busy: false });
      }
    } catch (e) {
      setToast(e instanceof Error ? e.message : String(e));
      setConflict({ ...conflict, busy: false });
    }
  }, [deps, conflict]);

  const getData = useCallback(() => dataRef.current, []);
  const statusText = outcomeText(outcome, { dirty, signedOut: !deps && !!data.settings.cloudReportId, paused, online, inCloud: !!data.settings.cloudKnownUpdatedAt });

  return {
    data, getData, mutate, save, saving, outcome, dirty, conflict, resolveConflict, paused, presence,
    dismissPresence: () => setPresence(null), toast, setToast, statusText, checkFreshness,
  };
}
