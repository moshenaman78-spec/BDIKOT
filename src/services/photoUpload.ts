/**
 * services/photoUpload.ts — העלאת תמונות לדלי report-files ופתרון קישורים — כמו בישן:
 *   - דחיסה: 1400px, JPEG 0.8 (compressImage(file, 1400, 0.8))
 *   - נתיב: {reportId}/{uuid}-{safeName}, upsert=false (לא דורסים קובץ קיים)
 *   - דוח שעדיין לא נוצר בענן → pendingUpload, ומועלית אחרי ה-INSERT (processPendingPhotoUploads)
 * הכל דרך PhotoStorage, כדי שהבדיקות ירוצו מול מימוש בזיכרון ולא מול הענן.
 */
import type { ReportData } from '@/core/reportModel';
import { BUCKETS, getSupabase } from './supabaseClient';
import { PHOTO_MAX_DIM, PHOTO_QUALITY, readPhotos } from './shared/photos';

export interface PhotoStorage {
  upload(path: string, blob: Blob): Promise<string>;
  signedUrl(path: string): Promise<string | null>;
}

export const supabasePhotoStorage: PhotoStorage = {
  async upload(path, blob) {
    const { data, error } = await getSupabase().storage.from(BUCKETS.reportFiles).upload(path, blob, { contentType: blob.type, upsert: false });
    if (error) throw error;
    return data.path;
  },
  async signedUrl(path) {
    const { data, error } = await getSupabase().storage.from(BUCKETS.reportFiles).createSignedUrl(path, 3600);
    return error ? null : data.signedUrl;
  },
};

/** כמו בישן: כל תו שאינו [A-Za-z0-9_.-] → '_' (שם בעברית הופך לקווים תחתונים). */
export function safeFileName(name: string): string {
  return (name || 'file').replace(/[^\w.-]/g, '_');
}

export function storagePathFor(reportId: string, fileName: string, uuid: string = crypto.randomUUID()): string {
  return `${reportId}/${uuid}-${safeFileName(fileName)}`;
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = /data:(.*?);base64/.exec(header)?.[1] ?? 'application/octet-stream';
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** דחיסה בדפדפן (canvas). */
export function compressImage(file: Blob, maxDim = PHOTO_MAX_DIM, quality = PHOTO_QUALITY): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('לא ניתן לקרוא את התמונה'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/** אפשר להעלות רק לדוח שכבר קיים בענן (Phase 2B בישן). */
export function canUploadNow(data: ReportData): boolean {
  return Boolean(data.settings.cloudReportId && !data.settings.cloudInsertPending);
}

export async function uploadPhoto(storage: PhotoStorage, reportId: string, dataUrl: string, fileName: string): Promise<string> {
  return storage.upload(storagePathFor(reportId, fileName || 'photo.jpg'), dataUrlToBlob(dataUrl));
}

/** מעלה את כל התמונות שממתינות. מחזיר [id, cloudPath] להצלחות; כישלון נשאר ממתין לניסיון הבא. */
export async function uploadPendingPhotos(
  storage: PhotoStorage, data: ReportData, inFlight: Set<string> = new Set(),
): Promise<Array<{ id: string; cloudPath: string }>> {
  if (!canUploadNow(data)) return [];
  const reportId = data.settings.cloudReportId!;
  const done: Array<{ id: string; cloudPath: string }> = [];
  for (const p of readPhotos(data).filter((x) => x.pendingUpload && x.dataUrl && !x.cloudPath && !inFlight.has(x.id))) {
    inFlight.add(p.id);
    try { done.push({ id: p.id, cloudPath: await uploadPhoto(storage, reportId, p.dataUrl, p.fileName) }); } catch { /* ינוסה שוב */ }
    finally { inFlight.delete(p.id); }
  }
  return done;
}

/** מטמון קישורים חתומים (55 דק׳, כמו בישן). */
export function createSignedUrlCache(storage: PhotoStorage, now: () => number = Date.now) {
  const cache = new Map<string, { url: string; expiresAt: number }>();
  return {
    peek(path: string): string | undefined {
      const c = cache.get(path);
      return c && c.expiresAt > now() ? c.url : undefined;
    },
    async get(path: string): Promise<string | undefined> {
      const hit = this.peek(path);
      if (hit) return hit;
      const url = await storage.signedUrl(path);
      if (url) cache.set(path, { url, expiresAt: now() + 55 * 60 * 1000 });
      return url ?? undefined;
    },
  };
}
