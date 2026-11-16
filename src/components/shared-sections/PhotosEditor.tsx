/**
 * components/shared-sections/PhotosEditor.tsx — כרטיס "תיעוד תמונות" (state.generalPhotos), משותף.
 * צילום במצלמה או בחירה מהגלריה; לכל תמונה כותרת וכמה הערות ממוספרות (1.1, 1.2...); סדר, מחיקה.
 * ההעלאה עצמה בידי המסך (onAddFiles) — הכרטיס רק מציג ועורך.
 */
import type { ReportData } from '@/core/reportModel';
import { Card, RoundButton } from '@/components/report-template';
import type { PhotoResolver } from '@/components/report-template/ReportDocumentView';
import {
  addPhotoNote, effectiveNotes, movePhoto, readPhotos, removePhoto, removePhotoNote, setPhotoNote, updatePhoto, writePhotos, type PhotoEntry,
} from '@/services/shared/photos';

type Mutate = (fn: (draft: ReportData) => void) => void;

export function PhotosEditor({ data, mutate, onAddFiles, resolvePhoto, busy, confirm = (m) => window.confirm(m) }: {
  data: ReportData; mutate: Mutate; onAddFiles: (files: File[]) => void; resolvePhoto: PhotoResolver; busy?: boolean; confirm?: (m: string) => boolean;
}) {
  const photos = readPhotos(data);
  const upd = (fn: (l: PhotoEntry[]) => PhotoEntry[]) => mutate((d) => writePhotos(d, fn(readPhotos(d))));
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length) onAddFiles(files);
  };
  return (
    <Card title={`תיעוד תמונות${photos.length ? ` (${photos.length})` : ''}`} icon="📷">
      <p className="sh-dim">לכל תמונה אפשר להוסיף כותרת וכמה הערות — הן ממוספרות אוטומטית (1.1, 1.2...) ומופיעות בדוח המודפס, בפרק נפרד בסוף הדוח.</p>
      <div className="sh-actions">
        <label className="sh-btn sh-btn--primary sh-filebtn">📷 צלם תמונה
          <input type="file" accept="image/*" capture="environment" onChange={pick} disabled={busy} aria-label="צלם תמונה" />
        </label>
        <label className="sh-btn sh-filebtn">🖼️ הוסף מהגלריה
          <input type="file" accept="image/*" multiple onChange={pick} disabled={busy} aria-label="הוסף תמונות מהגלריה" />
        </label>
        {busy ? <span className="sh-dim">מעבד תמונות…</span> : null}
      </div>
      {photos.length ? (
        <div className="sh-photo-edit">
          {photos.map((p, i) => {
            const src = p.dataUrl || (p.cloudPath ? resolvePhoto(p.cloudPath) : '') || '';
            const notes = effectiveNotes(p);
            const state = p.pendingUpload ? '⏳ ממתינה להעלאה' : p.cloudPath ? '☁️ בענן' : '📱 במכשיר';
            return (
              <div key={p.id} className="sh-photo-edit__card">
                <div className="sh-photo-edit__img">
                  {src ? <img src={src} alt={p.title || `תמונה ${i + 1}`} /> : <div style={{ height: 180 }} />}
                  <span className="sh-photo-edit__num">תמונה {i + 1}</span>
                  <span className="sh-photo-edit__state">{state}</span>
                </div>
                <div className="sh-photo-edit__body">
                  <div className="sh-photo-edit__tools">
                    <button type="button" className="sh-btn" disabled={i === 0} aria-label={`הזז תמונה ${i + 1} קדימה`} onClick={() => upd((l) => movePhoto(l, p.id, -1))}>→</button>
                    <button type="button" className="sh-btn" disabled={i === photos.length - 1} aria-label={`הזז תמונה ${i + 1} אחורה`} onClick={() => upd((l) => movePhoto(l, p.id, 1))}>←</button>
                    <RoundButton kind="remove" label={`מחק תמונה ${i + 1}`} onClick={() => { if (confirm(`למחוק את תמונה ${i + 1}?`)) upd((l) => removePhoto(l, p.id)); }} />
                  </div>
                  <input className="sh-input" style={{ width: '100%', fontWeight: 700 }} aria-label={`כותרת תמונה ${i + 1}`} placeholder="כותרת לתמונה (לדוגמה: חדר שנאים)" value={p.title}
                    onChange={(e) => upd((l) => updatePhoto(l, p.id, (x) => ({ ...x, title: e.target.value })))} />
                  {(notes.length ? notes : ['']).map((n, ni) => (
                    <div key={ni} className="sh-numbered">
                      <span className="sh-numbered__n" style={{ minWidth: 36, borderRadius: 8, fontSize: '.75rem' }}>{i + 1}.{ni + 1}</span>
                      <textarea className="sh-input sh-textarea" style={{ minHeight: 60 }} aria-label={`הערה ${i + 1}.${ni + 1}`} value={n}
                        onChange={(e) => upd((l) => updatePhoto(l, p.id, (x) => setPhotoNote(x, ni, e.target.value)))} />
                      {notes.length > 1 ? <RoundButton kind="remove" label={`הסר הערה ${i + 1}.${ni + 1}`} onClick={() => upd((l) => updatePhoto(l, p.id, (x) => removePhotoNote(x, ni)))} /> : null}
                    </div>
                  ))}
                  <button type="button" className="sh-btn" style={{ width: '100%' }} onClick={() => upd((l) => updatePhoto(l, p.id, addPhotoNote))}>+ הוסף הערה</button>
                </div>
              </div>
            );
          })}
        </div>
      ) : <p className="sh-dim">עדיין לא הועלו תמונות.</p>}
    </Card>
  );
}
