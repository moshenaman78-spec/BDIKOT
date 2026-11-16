/**
 * features/report-editor/useReportEditor.ts — ניהול דוח פתוח בעורך (לכל סוגי הדוחות).
 *
 * - mutate(): כל עריכה מעלה settings.cloudEditSeq (כמו בישן) — כך יודעים אם יש שינויים שלא נשמרו.
 * - שמירה אוטומטית 5 שניות אחרי עריכה (כמו בישן), רק כשיש חיבור, אין קונפליקט פתוח ויש שינויים.
 * - גיבוי מקומי לכל עריכה (מפתח נפרד מזה של האפליקציה הישנה — לא דורס את inspection-current).
 * - קונפליקט: נפתחת חלונית; עד שהמשתמש בוחר, השמירה האוטומטית מושהית.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReportData } from '@/core/reportModel';
import {
  loadReport, resolveCompare, resolveSaveAsCopy, saveReport, type SaveOutcome, type SyncDeps,
} from '@/services/reportSyncService';
import { isLocalDirty, type ConflictActionId, type FieldDiff } from '@/services/sync/saveRules';

export const AUTOSAVE_MS = 5000;
const BACKUP_PREFIX = 'app-report-backup:';

export function backupKey(data: ReportData): string | null {
  return data.settings.cloudReportId ? BACKUP_PREFIX + data.settings.cloudReportId : null;
}

export function writeBackup(data: ReportData): void {
  const key = backupKey(data);
  if (!key) return;
  try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* אחסון מלא — לא קריטי */ }
}

export function readBackup(reportId: string): ReportData | null {
  try {
    const raw = localStorage.getItem(BACKUP_PREFIX + reportId);
    return raw ? (JSON.parse(raw) as ReportData) : null;
  } catch {
    return null;
  }
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

export function outcomeText(o: SaveOutcome | null, dirty: boolean): string {
  if (!o) return dirty ? 'יש שינויים שלא נשמרו' : 'לא נשמר עדיין';
  switch (o.kind) {
    case 'saved': return dirty ? 'יש שינויים חדשים שלא נשמרו' : o.created ? 'נוצר ונשמר בענן ✓' : 'נשמר בענן ✓';
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
  const [toast, setToast] = useState<string | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const savingRef = useRef(false);
  const onSavedRef = useRef(opts.onSaved);
  onSavedRef.current = opts.onSaved;

  useEffect(() => { setData(initial); setOutcome(null); setConflict(null); }, [initial]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); }, [toast]);

  const mutate = useCallback((fn: (draft: ReportData) => void) => {
    setData((cur) => {
      const draft = structuredClone(cur);
      fn(draft);
      draft.settings.cloudEditSeq = (draft.settings.cloudEditSeq || 0) + 1;
      writeBackup(draft);
      return draft;
    });
  }, []);

  const save = useCallback(async (): Promise<SaveOutcome | null> => {
    if (!deps || savingRef.current) return null;
    savingRef.current = true;
    setSaving(true);
    const snapshot = structuredClone(dataRef.current);
    try {
      const o = await saveReport(deps, snapshot);
      setOutcome(o);
      if (o.kind === 'saved') {
        const next = applySyncResult(dataRef.current, snapshot);
        dataRef.current = next;
        setData((cur) => { const n = applySyncResult(cur, snapshot); writeBackup(n); return n; });
        onSavedRef.current?.(o);
      }
      else if (o.kind === 'conflict') setConflict({ deleted: o.deleted, diff: null, busy: false });
      return o;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [deps]);

  const dirty = isLocalDirty(data.settings.cloudEditSeq || 0, data.settings.cloudSyncedSeq || 0) || data.settings.cloudInsertPending;

  // שמירה אוטומטית
  useEffect(() => {
    if (!deps || conflict || !dirty || !data.settings.cloudReportId) return;
    const t = setTimeout(() => { void save(); }, AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [data, deps, conflict, dirty, save]);

  const resolveConflict = useCallback(async (action: ConflictActionId) => {
    if (!deps || !conflict) return;
    if (action === 'cancel') { setConflict(null); return; }
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
        if (loaded) { setData(loaded.data); writeBackup(loaded.data); setOutcome(null); setToast('נטענה גרסת הענן'); }
        setConflict(null);
        return;
      }
      if (action === 'save-as-copy') {
        const { copy, outcome: o } = await resolveSaveAsCopy(deps, cur);
        setOutcome(o);
        if (o.kind === 'saved') { setData(copy); writeBackup(copy); setToast(`נשמר כעותק נפרד — מספר ${copy.meta.reportNumber}`); setConflict(null); }
        else setConflict({ ...conflict, busy: false });
      }
    } catch (e) {
      setToast(e instanceof Error ? e.message : String(e));
      setConflict({ ...conflict, busy: false });
    }
  }, [deps, conflict]);

  const getData = useCallback(() => dataRef.current, []);

  return { data, getData, mutate, save, saving, outcome, dirty, conflict, resolveConflict, toast, setToast, statusText: outcomeText(outcome, dirty) };
}
