/**
 * features/report-screen/ReportScreen.tsx — המסך הראשי לסוגי הדוחות שהועברו:
 * רשימת טיוטות (כל הסוגים שהועברו, סינון וחיפוש) → דוח חדש / פתיחה / הדגמה → עורך + תצוגה/הדפסה,
 * שמירה לפי כללי השמירה, סנכרון בין מכשירים, תמונות וחלונית קונפליקט.
 */
import { LEGACY_APP_URL } from '@/config';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { emptyMeta, emptySettings, formatLastUpdated, type ReportData } from '@/core/reportModel';
import { REPORT_TYPES, reportTypeDisplayName, type ReportTypeCode } from '@/core/reportTypes';
import { Card, ConflictDialog, ReportDocumentView, SaveBar, waitForImages } from '@/components/report-template';
import {
  EMPTY_IMAGES, EMPTY_PROFILE, imagesFromReport, loadCompanyImages, loadCompanyProfile, profileWithReportFallback,
  type CompanyImages, type CompanyProfile,
} from '@/services/companySettingsService';
import { canUploadNow, compressImage, createSignedUrlCache, supabasePhotoStorage, uploadPendingPhotos, uploadPhoto } from '@/services/photoUpload';
import { makePhotoEntry, markUploaded, readPhotos, writePhotos } from '@/services/shared/photos';
import { loadEquipment, type Equipment } from '@/services/shared/testInstruments';
import { createNewReport, loadReport, typeCodeOf, type SyncDeps } from '@/services/reportSyncService';
import { renderReportDocument, serviceFor, validateReport, writeTypeData } from '@/services/reports';
import type { DraftListItem } from '@/services/sync/reportStore';
import { localIsoDate } from '@/services/sync/editorRules';
import { useCloud } from '@/features/report-editor/useCloud';
import { isDirty, readBackup, useReportEditor } from '@/features/report-editor/useReportEditor';
import { MIGRATED_EDITORS, MIGRATED_TYPES } from './editors';

export function demoReport(code: ReportTypeCode): ReportData {
  const data: ReportData = {
    meta: { ...emptyMeta(), reportNumber: `${REPORT_TYPES[code].numberPrefix}-הדגמה`, date: localIsoDate() },
    settings: emptySettings(REPORT_TYPES[code].nameHe),
    notes: [''],
    customDeclaration: '',
    showElectricianDeclaration: true,
    approvalStatus: '',
  };
  const svc = serviceFor(code);
  writeTypeData(svc, data, svc.createEmpty());
  return data;
}

/** הגדרות חברה, תמונות וציוד — נטענים פעם אחת מהענן, קריאה בלבד. */
export interface CompanyContext { profile: CompanyProfile; images: CompanyImages; equipment: Equipment[] | null; error: string }
const EMPTY_CTX: CompanyContext = { profile: EMPTY_PROFILE, images: EMPTY_IMAGES, equipment: null, error: '' };

export function ReportScreen({ initialDemo }: { initialDemo?: ReportTypeCode | null }) {
  const { cloud, deps } = useCloud();
  const [opened, setOpened] = useState<ReportData | null>(() => (initialDemo ? demoReport(initialDemo) : null));
  const [company, setCompany] = useState<CompanyContext>(EMPTY_CTX);

  useEffect(() => {
    if (cloud.status !== 'ready') return;
    let alive = true;
    (async () => {
      try {
        const profile = await loadCompanyProfile();
        const [images, equipment] = await Promise.all([loadCompanyImages(profile).catch(() => EMPTY_IMAGES), loadEquipment().catch(() => null)]);
        if (alive) setCompany({ profile, images, equipment, error: '' });
      } catch (e) {
        if (alive) setCompany({ ...EMPTY_CTX, error: 'לא ניתן לטעון את הגדרות החברה: ' + (e instanceof Error ? e.message : String(e)) });
      }
    })();
    return () => { alive = false; };
  }, [cloud.status]);

  if (!opened) return <ReportPicker deps={deps} onOpen={setOpened} />;
  return <EditorView initial={opened} deps={deps} company={company} onClose={() => setOpened(null)} />;
}

function ReportPicker({ deps, onOpen }: { deps: SyncDeps | null; onOpen: (d: ReportData) => void }) {
  const [drafts, setDrafts] = useState<DraftListItem[] | null>(null);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<ReportTypeCode | 'all'>('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!deps) return;
    setDrafts(null); setError('');
    deps.store.listDrafts()
      .then((all) => setDrafts(all.filter((d) => MIGRATED_TYPES.includes(d.report_type as ReportTypeCode) && d.chapter_count === 0)))
      .catch((e) => { setDrafts([]); setError('לא ניתן לטעון את רשימת הטיוטות: ' + (e instanceof Error ? e.message : String(e))); });
  }, [deps, reloadKey]);

  const localDirty = useMemo(() => new Set((drafts ?? []).filter((d) => { const b = readBackup(d.id); return !!b && isDirty(b); }).map((d) => d.id)), [drafts]);

  const filtered = useMemo(() => {
    const q = query.trim();
    return (drafts ?? []).filter((d) => (typeFilter === 'all' || d.report_type === typeFilter)
      && (!q || [d.report_number, d.report_title, d.client_name, d.project_name].some((v) => v?.includes(q))));
  }, [drafts, query, typeFilter]);

  const open = async (id: string) => {
    if (!deps) return;
    setBusy(true); setError('');
    try {
      const loaded = await loadReport(deps.store, id);
      if (!loaded) { setError('הדוח לא נמצא בענן (ייתכן שאורכב או נמחק במכשיר אחר).'); return; }
      const code = typeCodeOf(loaded.data);
      if (!MIGRATED_EDITORS[code]) { setError(`"${reportTypeDisplayName(code)}" עדיין לא הועבר לאפליקציה החדשה — פתח אותו באפליקציה הקיימת.`); return; }
      // גיבוי מקומי עם שינויים שלא הגיעו לענן — נפתח הוא (לא נזרק בשקט); אם הענן התקדם — חלונית השוואה בעורך
      const backup = readBackup(id);
      onOpen(backup && isDirty(backup) && backup.settings.cloudReportId === id ? backup : loaded.data);
    } catch (e) {
      setError('פתיחת הדוח נכשלה: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  const createNew = async (code: ReportTypeCode) => {
    if (!deps) return;
    setBusy(true); setError('');
    try { onOpen(await createNewReport(deps, code)); } catch (e) { setError('יצירת הדוח נכשלה: ' + (e instanceof Error ? e.message : String(e))); } finally { setBusy(false); }
  };

  return (
    <div className="sh-container">
      <Card title="דוח חדש" icon="➕">
        {error ? <p className="sh-skeleton-note" role="alert">{error}</p> : null}
        {!deps ? <p className="sh-skeleton-note">לא מחובר לענן — אפשר רק הדגמה מקומית.</p> : null}
        <div className="sh-type-grid">
          {MIGRATED_TYPES.map((code) => (
            <div key={code} className="sh-type-card">
              <div className="sh-type-card__title"><span aria-hidden>{REPORT_TYPES[code].icon}</span> {REPORT_TYPES[code].nameHe}</div>
              <div className="sh-actions">
                <button type="button" className="sh-btn sh-btn--primary" disabled={!deps || busy} onClick={() => createNew(code)}>דוח חדש</button>
                <button type="button" className="sh-btn" onClick={() => onOpen(demoReport(code))}>🧪 הדגמה</button>
              </div>
            </div>
          ))}
        </div>
        <p className="sh-dim">שאר סוגי הדוחות — באפליקציה הקיימת (<a href={LEGACY_APP_URL} target="_blank" rel="noopener">פתח</a>).</p>
      </Card>
      {deps ? (
        <Card title={`טיוטות בענן${drafts ? ` (${drafts.length})` : ''}`} icon="📁"
          actions={<button type="button" className="sh-btn" onClick={() => setReloadKey((k) => k + 1)} aria-label="רענן רשימה">⟳ רענן</button>}>
          <div className="sh-filter">
            <input className="sh-input" placeholder="חיפוש לפי מספר דוח, אתר, לקוח…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="חיפוש טיוטות" />
            <select className="sh-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as ReportTypeCode | 'all')} aria-label="סינון לפי סוג">
              <option value="all">כל הסוגים</option>
              {MIGRATED_TYPES.map((c) => <option key={c} value={c}>{REPORT_TYPES[c].nameHe}</option>)}
            </select>
          </div>
          {drafts === null ? <p className="sh-dim">טוען…</p> : (
            <ul className="sh-list">
              {filtered.map((d) => (
                <li key={d.id}>
                  <span>
                    <span className="sh-type-badge">{REPORT_TYPES[d.report_type as ReportTypeCode]?.icon} {reportTypeDisplayName(d.report_type ?? '')}</span><br />
                    <b>{d.report_number || '—'}</b> · {[d.report_title, d.client_name].filter(Boolean).join(' · ') || 'ללא שם'}
                    <br /><span className="sh-dim">עודכן {formatLastUpdated(d.updated_at)}
                      {d.saved_by_device && d.saved_by_device !== deps.deviceId ? ' · 👥 נשמר לאחרונה במכשיר אחר' : ''}
                      {localDirty.has(d.id) ? ' · 💾 יש במכשיר הזה שינויים שלא נשמרו' : ''}
                    </span>
                  </span>
                  <button type="button" className="sh-btn" disabled={busy} onClick={() => open(d.id)}>פתח</button>
                </li>
              ))}
              {!filtered.length ? <li className="sh-dim">{drafts.length ? 'אין טיוטות תואמות' : 'אין טיוטות עדיין'}</li> : null}
            </ul>
          )}
        </Card>
      ) : null}
    </div>
  );
}

function EditorView({ initial, deps, company, onClose }: { initial: ReportData; deps: SyncDeps | null; company: CompanyContext; onClose: () => void }) {
  const storage = supabasePhotoStorage;
  const uploadPendingRef = useRef<() => void>(() => {});
  const ed = useReportEditor(initial, deps, { onSaved: (o) => { if (o.kind === 'saved') uploadPendingRef.current(); } });
  const [preview, setPreview] = useState(false);
  const [photosBusy, setPhotosBusy] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const cache = useMemo(() => createSignedUrlCache(storage), [storage]);
  const isDemo = !initial.settings.cloudReportId;
  const code = typeCodeOf(ed.data);
  const Editor = MIGRATED_EDITORS[code];

  // הגדרות חברה: מהענן, ושדה ריק נופל לעותק שבדוח עצמו (report_data.settings)
  const profile = useMemo(() => profileWithReportFallback(company.profile, ed.data.settings), [company.profile, ed.data.settings]);
  const images = useMemo<CompanyImages>(() => {
    const fromReport = imagesFromReport(ed.data.settings);
    return {
      logo: company.images.logo || fromReport.logo, signature: company.images.signature || fromReport.signature,
      footerLogo: company.images.footerLogo || fromReport.footerLogo, inspectorLicense: company.images.inspectorLicense || fromReport.inspectorLicense,
    };
  }, [company.images, ed.data.settings]);
  const docOpts = useMemo(() => ({ company: profile, equipment: company.equipment ?? undefined }), [profile, company.equipment]);
  const issues = useMemo(() => validateReport(ed.data, docOpts), [ed.data, docOpts]);
  // המסמך תמיד מוכן — גם הדפסה מתוך מצב עריכה (Ctrl+P) מדפיסה את הדוח ולא דף ריק
  const doc = useMemo(() => renderReportDocument(ed.data, ed.data.settings.cloudKnownUpdatedAt, docOpts), [ed.data, docOpts]);

  // תמונות ענן בלי עותק מקומי — קישור חתום (קריאה בלבד)
  const cloudKey = readPhotos(ed.data).filter((p) => p.cloudPath && !p.dataUrl && !urls[p.cloudPath]).map((p) => p.cloudPath).join('|');
  useEffect(() => {
    if (!deps || !cloudKey) return;
    let alive = true;
    Promise.all(cloudKey.split('|').map(async (path) => [path, await cache.get(path)] as const)).then((pairs) => {
      if (!alive) return;
      setUrls((u) => { const n = { ...u }; for (const [path, url] of pairs) if (url) n[path] = url; return n; });
    });
    return () => { alive = false; };
  }, [deps, cloudKey, cache]);
  const resolvePhoto = useCallback((path: string) => urls[path] ?? cache.peek(path), [urls, cache]);

  const { mutate, setToast, getData } = ed;
  const applyUploads = useCallback((done: Array<{ id: string; cloudPath: string }>) => {
    if (!done.length) return;
    mutate((d) => { let list = readPhotos(d); for (const u of done) list = markUploaded(list, u.id, u.cloudPath); writePhotos(d, list); });
  }, [mutate]);

  // אחרי יצירת הדוח בענן (או בפתיחה) — מעלים תמונות שממתינות; inFlight מונע העלאה כפולה
  const inFlight = useRef(new Set<string>());
  uploadPendingRef.current = () => { if (deps) void uploadPendingPhotos(storage, getData(), inFlight.current).then(applyUploads); };
  useEffect(() => { if (deps) uploadPendingRef.current(); }, [deps]);

  const addPhotos = useCallback(async (files: File[]) => {
    setPhotosBusy(true);
    try {
      for (const file of files) {
        let dataUrl: string;
        try { dataUrl = await compressImage(file); } catch { setToast(`לא ניתן לקרוא את התמונה ${file.name}`); continue; }
        const entry = makePhotoEntry(dataUrl, file.name, file.type);
        const cur = getData();
        const uploadNow = !!deps && canUploadNow(cur);
        if (deps && !uploadNow) entry.pendingUpload = true; // תועלה אחרי שהדוח ייווצר בענן
        mutate((d) => writePhotos(d, [...readPhotos(d), entry]));
        if (uploadNow) {
          inFlight.current.add(entry.id);
          uploadPhoto(storage, cur.settings.cloudReportId!, dataUrl, file.name)
            .then((cloudPath) => applyUploads([{ id: entry.id, cloudPath }]))
            .catch((e) => {
              mutate((d) => writePhotos(d, readPhotos(d).map((p) => (p.id === entry.id ? { ...p, pendingUpload: true } : p))));
              setToast('העלאת התמונה נכשלה — נשמרה במכשיר ותועלה שוב בשמירה הבאה. ' + (e instanceof Error ? e.message : String(e)));
            })
            .finally(() => inFlight.current.delete(entry.id));
        }
      }
    } finally {
      setPhotosBusy(false);
    }
  }, [deps, storage, applyUploads, mutate, setToast, getData]);

  const errorsCount = issues.filter((i) => i.severity === 'error').length;
  const print = useCallback(async () => {
    if (errorsCount && !window.confirm(`יש ${errorsCount} שגיאות בבדיקות לפני הפקה (למשל מסקנה חסרה או כיול שפג). להדפיס בכל זאת?`)) return;
    await waitForImages();
    window.print();
  }, [errorsCount]);

  const close = useCallback(() => {
    if (ed.dirty && !isDemo && !window.confirm('יש שינויים שעוד לא נשמרו בענן (הם שמורים מקומית במכשיר). לחזור לרשימה?')) return;
    onClose();
  }, [ed.dirty, isDemo, onClose]);

  // שם הקובץ בהדפסה ל-PDF = כותרת המסמך
  useEffect(() => {
    const prev = document.title;
    document.title = [ed.data.meta.reportNumber, REPORT_TYPES[code].nameHe, ed.data.meta.siteName].filter(Boolean).join(' - ');
    return () => { document.title = prev; };
  }, [ed.data.meta.reportNumber, ed.data.meta.siteName, code]);

  return (
    <div className="sh-container">
      <div className="sh-actions sh-no-print" style={{ margin: '12px 0' }}>
        <button type="button" className="sh-btn" onClick={close}>→ חזרה לרשימה</button>
        <span className="sh-type-badge">{REPORT_TYPES[code].icon} {REPORT_TYPES[code].nameHe}</span>
        {isDemo ? <span className="sh-skeleton-note">מצב הדגמה — לא נשמר בענן</span> : null}
        {company.error ? <span className="sh-skeleton-note" role="alert">{company.error}</span> : null}
      </div>

      {ed.presence ? (
        <div className="sh-banner sh-banner--warn sh-no-print sh-presence" role="status">
          <span>👥 {ed.presence}</span>
          <button type="button" className="sh-btn" onClick={ed.dismissPresence}>הבנתי</button>
        </div>
      ) : null}

      {issues.length ? (
        <details className="sh-issues-box sh-no-print" open={errorsCount > 0}>
          <summary>
            🔎 בדיקות לפני הפקה: {errorsCount ? <b className="sh-text-bad">{errorsCount} שגיאות</b> : null}{errorsCount && issues.length - errorsCount ? ' · ' : ''}{issues.length - errorsCount ? `${issues.length - errorsCount} אזהרות` : ''}
          </summary>
          <ul className="sh-issues">
            {issues.map((i) => <li key={i.path + i.message} className={i.severity === 'error' ? 'is-error' : ''}>{i.severity === 'error' ? '⛔' : '⚠️'} {i.message}</li>)}
          </ul>
        </details>
      ) : null}

      {!Editor ? <p className="sh-skeleton-note">סוג הדוח הזה עדיין לא הועבר — פתח אותו באפליקציה הקיימת.</p>
        : preview
          ? <ReportDocumentView doc={doc} images={images} resolvePhoto={resolvePhoto} />
          : (
            <div className="sh-no-print">
              <Editor data={ed.data} mutate={ed.mutate}
                shared={{ equipment: company.equipment, electricianHiddenGlobally: profile.hideElectricianDeclaration, onAddPhotos: (f) => { void addPhotos(f); }, resolvePhoto, photosBusy }} />
            </div>
          )}
      {/* בהדפסה מתוך מצב עריכה — זה מה שיודפס */}
      {preview || !Editor ? null : <div className="sh-print-only"><ReportDocumentView doc={doc} images={images} resolvePhoto={resolvePhoto} /></div>}

      <SaveBar
        status={isDemo ? 'הדגמה מקומית' : ed.statusText}
        lastSavedAt={ed.data.settings.cloudKnownUpdatedAt}
        canSave={!!deps && !isDemo}
        saving={ed.saving}
        previewOn={preview}
        onSave={() => { void ed.save(); }}
        onTogglePreview={() => setPreview(!preview)}
        onPrint={() => { void print(); }}
      />
      {ed.conflict ? <ConflictDialog deleted={ed.conflict.deleted} diff={ed.conflict.diff} busy={ed.conflict.busy} onAction={(a) => { void ed.resolveConflict(a); }} /> : null}
      {ed.toast ? <div className="sh-toast" role="status">{ed.toast}</div> : null}
    </div>
  );
}
