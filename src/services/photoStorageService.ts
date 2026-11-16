/**
 * services/photoStorageService.ts — תמונות/קבצים בדלי report-files.
 * נתיב: {reportId}/{uuid}-{safeName}, upsert=false (לא דורסים קובץ קיים) — כמו באפליקציה הישנה.
 * תמונה שנוספה לפני שהדוח נוצר בענן מסומנת pendingUpload ומועלית אחרי ה-INSERT.
 */
import { BUCKETS, getSupabase } from './supabaseClient';

export interface PhotoRef {
  storagePath: string | null;
  caption: string;
  pendingUpload?: boolean;
}

export function safeFileName(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]/g, '_').slice(-80) || 'file';
}

export function buildStoragePath(reportId: string, fileName: string, uuid: string = crypto.randomUUID()): string {
  return `${reportId}/${uuid}-${safeFileName(fileName)}`;
}

export async function uploadReportFile(reportId: string, file: Blob, fileName: string): Promise<string> {
  const path = buildStoragePath(reportId, fileName);
  const { error } = await getSupabase().storage.from(BUCKETS.reportFiles).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

export async function signedUrl(storagePath: string, seconds = 3600): Promise<string> {
  const { data, error } = await getSupabase().storage.from(BUCKETS.reportFiles).createSignedUrl(storagePath, seconds);
  if (error) throw error;
  return data.signedUrl;
}

// TODO(photos): דחיסת תמונה לפני העלאה + תור pendingUpload (processPendingPhotoUploads בישן).
