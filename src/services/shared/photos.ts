/**
 * services/shared/photos.ts — "תיעוד תמונות" (state.generalPhotos בישן), משותף לכל הסוגים.
 *
 * רשומת תמונה זהה לישן (makePhotoEntry): { id, dataUrl, cloudPath, fileName, mimeType, title,
 * caption, notes[], uploadedAt, pendingUpload? }. הערות ממוספרות "מספר-תמונה.מספר-הערה".
 * תמונה ישנה עם caption ובלי notes מוצגת כאילו caption היא הערה 1 (כמו בישן).
 *
 * העלאה (photoUpload.ts): דחיסה ל-1400px/0.8, דלי report-files, נתיב {reportId}/{uuid}-{name}.
 * כל עוד הדוח לא נוצר בענן — pendingUpload=true, ומועלית אחרי היצירה. dataUrl נשאר ברשומה
 * (כמו בישן) — גיבוי לתצוגה בלי רשת.
 *
 * בהדפסה: פרק נפרד שמתחיל בעמוד חדש, 2 תמונות בשורה, עד 4 בעמוד, שורה לא נשברת בין עמודים.
 */
import type { DocumentSection, ReportData } from '@/core/reportModel';

export const LEGACY_KEY = 'generalPhotos';
export const PHOTO_MAX_DIM = 1400;
export const PHOTO_QUALITY = 0.8;
export const PHOTOS_PER_PAGE = 4;

export interface PhotoEntry {
  id: string;
  dataUrl: string;
  cloudPath: string;
  fileName: string;
  mimeType: string;
  title: string;
  caption: string;
  notes: string[];
  uploadedAt: string;
  pendingUpload?: boolean;
  [legacyField: string]: unknown;
}

export function makePhotoId(): string {
  return 'panel_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function makePhotoEntry(dataUrl: string, fileName = '', mimeType = 'image/jpeg'): PhotoEntry {
  return { id: makePhotoId(), dataUrl, cloudPath: '', fileName, mimeType: mimeType || 'image/jpeg', title: '', caption: '', notes: [], uploadedAt: new Date().toISOString() };
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');

export function normalizePhoto(raw: unknown): PhotoEntry {
  const p = (raw && typeof raw === 'object' ? raw : {}) as Partial<PhotoEntry>;
  const notes = Array.isArray(p.notes) ? p.notes.map(str) : [];
  return {
    ...p,
    id: str(p.id) || makePhotoId(),
    dataUrl: str(p.dataUrl), cloudPath: str(p.cloudPath), fileName: str(p.fileName), mimeType: str(p.mimeType) || 'image/jpeg',
    title: str(p.title), caption: str(p.caption), notes, uploadedAt: str(p.uploadedAt),
  };
}

export function readPhotos(data: ReportData): PhotoEntry[] {
  const raw = data[LEGACY_KEY];
  return Array.isArray(raw) ? raw.map(normalizePhoto) : [];
}

export function writePhotos(data: ReportData, photos: PhotoEntry[]): void {
  data[LEGACY_KEY] = photos;
}

/** ההערות להצגה: notes, או caption ישן אם אין notes. */
export function effectiveNotes(p: PhotoEntry): string[] {
  return p.notes.length ? p.notes : p.caption ? [p.caption] : [];
}

/** תמונה שיש לה מקור (מקומי או ענן) — רק אותן מדפיסים (כמו relevantPhotos בישן). */
export function hasSource(p: PhotoEntry): boolean {
  return Boolean(p.dataUrl || p.cloudPath);
}

/* ------------------------------ פעולות ------------------------------ */

export function updatePhoto(list: PhotoEntry[], id: string, fn: (p: PhotoEntry) => PhotoEntry): PhotoEntry[] {
  return list.map((p) => (p.id === id ? fn(p) : p));
}

export function removePhoto(list: PhotoEntry[], id: string): PhotoEntry[] {
  return list.filter((p) => p.id !== id);
}

export function movePhoto(list: PhotoEntry[], id: string, delta: -1 | 1): PhotoEntry[] {
  const i = list.findIndex((p) => p.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** עריכת הערה — קודם ממירים caption ישן להערה (כמו בישן בפתיחת הכרטיס), כדי שלא תאבד. */
export function setPhotoNote(p: PhotoEntry, index: number, text: string): PhotoEntry {
  const notes = [...effectiveNotes(p)];
  while (notes.length <= index) notes.push('');
  notes[index] = text;
  return { ...p, notes, caption: p.notes.length ? p.caption : '' };
}

export function addPhotoNote(p: PhotoEntry): PhotoEntry {
  return { ...p, notes: [...effectiveNotes(p), ''], caption: p.notes.length ? p.caption : '' };
}

export function removePhotoNote(p: PhotoEntry, index: number): PhotoEntry {
  const notes = effectiveNotes(p).filter((_, i) => i !== index);
  return { ...p, notes, caption: '' };
}

/** אחרי העלאה מוצלחת. */
export function markUploaded(list: PhotoEntry[], id: string, cloudPath: string): PhotoEntry[] {
  return updatePhoto(list, id, (p) => {
    const { pendingUpload: _drop, ...rest } = p;
    void _drop;
    return { ...rest, cloudPath } as PhotoEntry;
  });
}

/* ------------------------------ פלט ------------------------------ */

export function photosSection(data: ReportData): DocumentSection | null {
  const list = readPhotos(data).filter(hasSource);
  if (!list.length) return null;
  return {
    id: 'photos', zone: 'appendix', title: 'תיעוד תמונות', icon: '📷', pageBreakBefore: true,
    blocks: [{
      kind: 'photos', perPage: PHOTOS_PER_PAGE,
      items: list.map((p, i) => ({
        number: i + 1, title: p.title.trim(), dataUrl: p.dataUrl, cloudPath: p.cloudPath,
        notes: effectiveNotes(p).map((n) => n.trim()).filter(Boolean),
      })),
    }],
  };
}
