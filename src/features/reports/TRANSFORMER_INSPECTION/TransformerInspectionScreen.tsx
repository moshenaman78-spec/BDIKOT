/**
 * features/reports/TRANSFORMER_INSPECTION/TransformerInspectionScreen.tsx
 *
 * בחירת דוח (טיוטות שנאי בענן / דוח חדש מפורש / הדגמה מקומית) → עורך + תצוגה מקדימה/הדפסה,
 * שמירה לפי כללי השמירה וחלונית קונפליקט.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { emptyMeta, emptySettings, type ReportData } from '@/core/reportModel';
import { REPORT_TYPES } from '@/core/reportTypes';
import { Card, ConflictDialog, ReportDocumentView, SaveBar, waitForImages } from '@/components/report-template';
import {
  EMPTY_IMAGES, EMPTY_PROFILE, imagesFromReport, loadCompanyImages, loadCompanyProfile, profileWithReportFallback,
  type CompanyImages, type CompanyProfile,
} from '@/services/companySettingsService';
import {
  canUploadNow, compressImage, createSignedUrlCache, supabasePhotoStorage, uploadPendingPhotos, uploadPhoto,
} from '@/services/photoUpload';
import { makePhotoEntry, markUploaded, readPhotos, writePhotos } from '@/services/shared/photos';
import { loadEquipment, type Equipment } from '@/services/shared/testInstruments';
import { createNewReport, loadReport, type SyncDeps } from '@/services/reportSyncService';
import { renderReportDocument, validateReport, writeTypeData } from '@/services/reports';
import type { DraftListItem } from '@/services/sync/reportStore';
import { transformerInspectionService } from '@/services/reports/types/transformerInspection.service';
import { formatLastUpdated } from '@/core/reportModel';
import { useCloud } from '@/features/report-editor/useCloud';
import { readBackup, useReportEditor } from '@/features/report-editor/useReportEditor';
import { TransformerInspectionEditor } from './TransformerInspectionEditor';

const CODE = 'TRANSFORMER_INSPECTION' as const;

function demoReport(): ReportData {
  const data: ReportData = {
    meta: { ...emptyMeta(), reportNumber: 'TR-הדגמה', date: new Date().toISOString().slice(0, 10) },
    settings: emptySettings(REPORT_TYPES[CODE].nameHe),
    notes: [''],
    customDeclaration: '',
  };
  writeTypeData(transformerInspectionService, data, transformerInspectionService.createEmpty());
  return data;
}

/** הגדרות חברה, תמונות וציוד — נטענים פעם אחת מהענן, קריאה בלבד. */
export interface CompanyContext { profile: CompanyProfile; images: CompanyImages; equipment: Equipment[] | null; error: string }

const EMPTY_CTX: CompanyContext = { profile: EMPTY_PROFILE, images: EMPTY_IMAGES, equipment: null, error: '' };

export function TransformerInspectionScreen() {
  const { cloud, deps } = useCloud();
  const [opened, setOpened] = useState<ReportData | null>(null);
  const [company, setCompany] = useState<CompanyContext>(EMPTY_CTX);

  useEffect(() => {
    if (cloud.status !== 'ready') return;
    (async () => {
      try {
        const profile = await loadCompanyProfile();
        const [images, equipment] = await Promise.all([loadCompanyImages(profile).catch(() => EMPTY_IMAGES), loadEquipment().catch(() => null)]);
        setCompany({ profile, images, equipment, error: '' });
      } catch (e) {
        setCompany({ ...EMPTY_CTX, error: 'לא ניתן לטעון את הגדרות החברה: ' + (e instanceof Error ? e.message : String(e)) });
      }
    })();
  }, [cloud.status]);

  if (!opened) {
    return <ReportPicker cloudStatus={cloud.status} cloudReason={cloud.status === 'off' ? cloud.reason : ''} deps={deps} onOpen={setOpened} />;
  }
  return <EditorView initial={opened} deps={deps} company={company} onClose={() => setOpened(null)} />;
}

function ReportPicker({ cloudStatus, cloudReason, deps, onOpen }: {
  cloudStatus: string; cloudReason: string; deps: SyncDeps | null; onOpen: (d: ReportData) => void;
}) {
  const [drafts, setDrafts] = useState<DraftListItem[] | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!deps) return;
    deps.store.listDrafts()
      .then((all) => setDrafts(all.filter((d) => d.report_type === CODE && d.chapter_count === 0)))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [deps]);

  const filtered = useMemo(() => {
    const q = query.trim();
    return (drafts ?? []).filter((d) => !q || [d.report_number, d.report_title, d.client_name, d.project_name].some((v) => v?.includes(q)));
  }, [drafts, query]);

  const open = async (id: string) => {
    if (!deps) return;
    setBusy(true);
    try {
      const loaded = await loadReport(deps.store, id);
      if (!loaded) { setError('הדוח לא נמצא בענן'); return; }
      // גיבוי מקומי משתמשים בו רק אם הוא מבוסס על אותה גרסת ענן בדיוק ויש בו שינויים — אחרת לא נוגעים
      const backup = readBackup(id);
      const usable = backup && backup.settings.cloudKnownUpdatedAt === loaded.row.updated_at
        && (backup.settings.cloudEditSeq || 0) > (backup.settings.cloudSyncedSeq || 0);
      onOpen(usable ? backup! : loaded.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const createNew = async () => {
    if (!deps) return;
    setBusy(true);
    try { onOpen(await createNewReport(deps, CODE)); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };

  return (
    <div className="sh-container">
      <Card title={REPORT_TYPES[CODE].nameHe} icon="🔋">
        {cloudStatus === 'off' ? <p className="sh-skeleton-note">{cloudReason}</p> : null}
        {cloudStatus === 'signed-out' ? <p className="sh-skeleton-note">לא מחובר. התחבר באפליקציה הקיימת באותו דפדפן ורענן את הדף (ההתחברות משותפת).</p> : null}
        {cloudStatus === 'loading' ? <p className="sh-dim">בודק חיבור…</p> : null}
        {error ? <p className="sh-skeleton-note" role="alert">{error}</p> : null}
        <div className="sh-actions">
          <button type="button" className="sh-btn sh-btn--primary" disabled={!deps || busy} onClick={createNew}>➕ דוח שנאי חדש</button>
          <button type="button" className="sh-btn" onClick={() => onOpen(demoReport())}>🧪 הדגמה מקומית (בלי שמירה)</button>
        </div>
      </Card>
      {deps ? (
        <Card title={`טיוטות שנאי בענן${drafts ? ` (${drafts.length})` : ''}`} icon="📁">
          <input className="sh-input" style={{ width: '100%' }} placeholder="חיפוש לפי מספר דוח, אתר, לקוח…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="חיפוש טיוטות" />
          {drafts === null ? <p className="sh-dim">טוען…</p> : (
            <ul className="sh-list">
              {filtered.map((d) => (
                <li key={d.id}>
                  <span>
                    <b>{d.report_number || '—'}</b> · {d.report_title || d.client_name || 'ללא שם'}
                    <br /><span className="sh-dim">עודכן {formatLastUpdated(d.updated_at)}</span>
                  </span>
                  <button type="button" className="sh-btn" disabled={busy} onClick={() => open(d.id)}>פתח</button>
                </li>
              ))}
              {!filtered.length ? <li className="sh-dim">אין טיוטות תואמות</li> : null}
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
  const doc = useMemo(() => (preview ? renderReportDocument(ed.data, ed.data.settings.cloudKnownUpdatedAt, docOpts) : null), [preview, ed.data, docOpts]);

  // תמונות ענן בלי עותק מקומי — קישור חתום (קריאה בלבד)
  const cloudOnly = readPhotos(ed.data).filter((p) => p.cloudPath && !p.dataUrl && !urls[p.cloudPath]).map((p) => p.cloudPath);
  const cloudKey = cloudOnly.join('|');
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

  const applyUploads = useCallback((done: Array<{ id: string; cloudPath: string }>) => {
    if (!done.length) return;
    ed.mutate((d) => { let list = readPhotos(d); for (const u of done) list = markUploaded(list, u.id, u.cloudPath); writePhotos(d, list); });
  }, [ed]);

  // אחרי יצירת הדוח בענן (או בפתיחה) — מעלים תמונות שממתינות
  uploadPendingRef.current = () => { void uploadPendingPhotos(storage, ed.getData()).then(applyUploads); };
  useEffect(() => { if (deps) uploadPendingRef.current(); }, [deps]);

  const addPhotos = useCallback(async (files: File[]) => {
    setPhotosBusy(true);
    try {
      for (const file of files) {
        let dataUrl: string;
        try { dataUrl = await compressImage(file); } catch { ed.setToast(`לא ניתן לקרוא את התמונה ${file.name}`); continue; }
        const entry = makePhotoEntry(dataUrl, file.name, file.type);
        const cur = ed.getData();
        const uploadNow = !!deps && canUploadNow(cur);
        if (deps && !uploadNow) entry.pendingUpload = true; // תועלה אחרי שהדוח ייווצר בענן
        ed.mutate((d) => writePhotos(d, [...readPhotos(d), entry]));
        if (uploadNow) {
          uploadPhoto(storage, cur.settings.cloudReportId!, dataUrl, file.name)
            .then((cloudPath) => applyUploads([{ id: entry.id, cloudPath }]))
            .catch((e) => ed.setToast('העלאת התמונה נכשלה (נשמרה במכשיר): ' + (e instanceof Error ? e.message : String(e))));
        }
      }
    } finally {
      setPhotosBusy(false);
    }
  }, [deps, ed, storage, applyUploads]);

  const print = useCallback(async () => {
    await waitForImages();
    window.print();
  }, []);

  const close = useCallback(() => {
    if (ed.dirty && !isDemo && !window.confirm('יש שינויים שעוד לא נשמרו בענן (הם שמורים מקומית במכשיר). לחזור לרשימה?')) return;
    onClose();
  }, [ed.dirty, isDemo, onClose]);

  return (
    <div className="sh-container">
      <div className="sh-actions sh-no-print" style={{ margin: '12px 0' }}>
        <button type="button" className="sh-btn" onClick={close}>→ חזרה לרשימה</button>
        {isDemo ? <span className="sh-skeleton-note">מצב הדגמה — לא נשמר בענן</span> : null}
        {company.error ? <span className="sh-skeleton-note" role="alert">{company.error}</span> : null}
      </div>

      {issues.length ? (
        <div className="sh-no-print">
          <Card title={`בדיקות לפני הפקה (${issues.length})`} icon="🔎">
            <ul className="sh-issues">
              {issues.map((i) => <li key={i.path + i.message} className={i.severity === 'error' ? 'is-error' : ''}>{i.severity === 'error' ? '⛔' : '⚠️'} {i.message}</li>)}
            </ul>
          </Card>
        </div>
      ) : null}

      {preview && doc
        ? <ReportDocumentView doc={doc} images={images} resolvePhoto={resolvePhoto} />
        : (
          <div className="sh-no-print">
            <TransformerInspectionEditor
              data={ed.data} mutate={ed.mutate}
              shared={{ equipment: company.equipment, electricianHiddenGlobally: profile.hideElectricianDeclaration, onAddPhotos: (f) => { void addPhotos(f); }, resolvePhoto, photosBusy }}
            />
          </div>
        )}

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
