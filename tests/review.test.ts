import { describe, expect, it } from 'vitest';
import { diffReportData } from '@/services/sync/saveRules';
import { displayValue, labelForPath, readableDiff } from '@/services/sync/diffLabels';
import { AUTOSAVE_MAX_WAIT_MS, autosaveDelay, localIsoDate, presenceWarning, shouldAutosave } from '@/services/sync/editorRules';
import { applySyncResult, isDirty, outcomeText } from '@/features/report-editor/useReportEditor';
import { uploadPendingPhotos, type PhotoStorage } from '@/services/photoUpload';
import { makePhotoEntry, writePhotos } from '@/services/shared/photos';
import type { ReportData } from '@/core/reportModel';
import { legacyTransformerReportData } from './fixtures/legacyTransformerReport';

const report = () => legacyTransformerReportData() as unknown as ReportData;

describe('השמירה האוטומטית', () => {
  const base = { online: true, hasCloudIdentity: true, dirty: true, conflictOpen: false, paused: false };
  it('מושהית אחרי "ביטול" בחלונית קונפליקט, ובזמן שהחלונית פתוחה', () => {
    expect(shouldAutosave(base)).toBe(true);
    expect(shouldAutosave({ ...base, paused: true })).toBe(false);
    expect(shouldAutosave({ ...base, conflictOpen: true })).toBe(false);
    expect(shouldAutosave({ ...base, dirty: false })).toBe(false);
    expect(shouldAutosave({ ...base, online: false })).toBe(false);
  });
  it('הקלדה רציפה: לא יותר מ-30 שנ׳ מהעריכה הראשונה שלא נשמרה', () => {
    expect(autosaveDelay(1000, null)).toBe(5000);
    expect(autosaveDelay(1000, 0)).toBe(5000);
    expect(autosaveDelay(27000, 0)).toBe(3000);
    expect(autosaveDelay(AUTOSAVE_MAX_WAIT_MS + 10, 0)).toBe(0);
  });
});

describe('אזהרת נוכחות — בודק אחר עובד על הדוח', () => {
  const now = Date.parse('2026-11-16T10:30:00Z');
  const meta = (dev: string | null, at: string) => ({ id: 'r', status: 'draft', updated_at: at, saved_by_device: dev });
  it('מכשיר אחר שמר בדקות האחרונות → אזהרה; אני / מזמן / אין → כלום', () => {
    expect(presenceWarning(meta('dev_other', '2026-11-16T10:27:00Z'), 'dev_me', now)).toContain('לפני 3 דק׳');
    expect(presenceWarning(meta('dev_me', '2026-11-16T10:27:00Z'), 'dev_me', now)).toBeNull();
    expect(presenceWarning(meta('dev_other', '2026-11-16T09:00:00Z'), 'dev_me', now)).toBeNull();
    expect(presenceWarning(null, 'dev_me', now)).toBeNull();
  });
});

describe('מצב שמירה', () => {
  it('הודעות ברורות: מושהה / לא מחובר / אין רשת', () => {
    expect(outcomeText(null, { dirty: true, signedOut: false, paused: true, online: true })).toContain('מושהית');
    expect(outcomeText(null, { dirty: true, signedOut: true, paused: false, online: true })).toContain('במכשיר בלבד');
    expect(outcomeText(null, { dirty: true, signedOut: false, paused: false, online: false })).toContain('כשהחיבור יחזור');
    expect(outcomeText({ kind: 'saved', updatedAt: 't', created: false }, false)).toBe('נשמר בענן ✓');
  });
  it('isDirty: עריכה שלא נשמרה או דוח שעוד לא נוצר', () => {
    const r = report();
    r.settings.cloudEditSeq = 2; r.settings.cloudSyncedSeq = 2;
    expect(isDirty(r)).toBe(false);
    r.settings.cloudEditSeq = 3;
    expect(isDirty(r)).toBe(true);
    expect(isDirty({ ...r, settings: { ...r.settings, cloudEditSeq: 0, cloudSyncedSeq: 0, cloudInsertPending: true } })).toBe(true);
    expect(applySyncResult(r, r).settings.cloudEditSeq).toBe(3);
  });
});

describe('השוואת שינויים קריאה', () => {
  it('תוויות בעברית לשדות נפוצים', () => {
    expect(labelForPath('meta.client')).toBe('מזמין הבדיקה');
    expect(labelForPath('notes.1')).toBe('הערה 2');
    expect(labelForPath('transformerInspectionReport.transformers.0.checklist.3.status')).toBe('שנאי 1 · מצב בידודים (Bushings) - ללא סדקים או נזק · סטטוס');
    expect(labelForPath('transformerInspectionReport.transformers.1.groundingMethod.crossSection')).toBe('שנאי 2 · הארקת שיטה · חתך מוליך');
    expect(labelForPath('transformerInspectionReport.transformers.0.insulationTests.4.value')).toBe('שנאי 1 · בידוד סיכוך - הארקה (Screen to Earth) · ערך');
    expect(labelForPath('transformerInspectionReport.summaryItems.0.text')).toBe('ממצא מסכם 1');
    expect(labelForPath('protectionRelays.0.settings.Igt')).toBe('ממסר #1 · זרם יתר — סף (I>)');
    expect(labelForPath('generalPhotos.2.notes.0')).toBe('תמונה 3 · הערה 3.1');
    expect(labelForPath('approvalStatus')).toBe('אישור חשמול');
    expect(labelForPath('some.unknown.path')).toBe('some.unknown.path');
  });
  it('ערכים: סטטוס בעברית, תמונה לא כמחרוזת, אובייקט שלם מסוכם, טקסט ארוך נחתך', () => {
    expect(displayValue('X', 'transformerInspectionReport.transformers.0.checklist.3.status')).toBe('לא תקין');
    expect(displayValue('data:image/jpeg;base64,' + 'A'.repeat(5000))).toBe('[תמונה]');
    expect(displayValue({ a: 1 })).toBe('פריט שלם');
    expect(displayValue('א'.repeat(300)).length).toBe(118);
    expect(displayValue(true)).toBe('כן');
    expect(displayValue('')).toBe('—');
  });
  it('מקצה לקצה: שינוי במכשיר אחר מול שינוי אצלי, בלי שדות טכניים', () => {
    const mine = report(); const cloud = report();
    mine.meta.siteName = 'אתר שלי';
    (cloud.transformerInspectionReport as { transformers: Array<{ checklist: Array<{ status: string }> }> }).transformers[0].checklist[3].status = 'X';
    writePhotos(mine, [{ ...makePhotoEntry('data:x', 'a.jpg'), id: 'p1' }]);
    const rows = readableDiff(diffReportData(mine, cloud));
    expect(rows.map((r) => r.label).sort()).toEqual(['שם המתקן', 'שנאי 1 · מצב בידודים (Bushings) - ללא סדקים או נזק · סטטוס', 'תמונה 1'].sort());
    expect(rows.find((r) => r.label === 'תמונה 1')).toMatchObject({ kind: 'changed', local: 'פריט שלם', cloud: 'פריט שלם' });
    expect(JSON.stringify(rows)).not.toContain('base64');
  });
});

describe('תיקונים נוספים', () => {
  it('תאריך מקומי — לא UTC (אחרי חצות בישראל)', () => {
    expect(localIsoDate(new Date(2026, 10, 17, 0, 30))).toBe('2026-11-17');
  });
  it('העלאת ממתינות לא מעלה פעמיים תמונה שכבר בהעלאה', async () => {
    let uploads = 0;
    const storage: PhotoStorage = { async upload(path) { uploads++; await new Promise((r) => setTimeout(r, 20)); return path; }, async signedUrl() { return null; } };
    const r = report();
    writePhotos(r, [{ ...makePhotoEntry('data:image/jpeg;base64,QUJD', 'a.jpg'), pendingUpload: true }]);
    const inFlight = new Set<string>();
    const [a, b] = await Promise.all([uploadPendingPhotos(storage, r, inFlight), uploadPendingPhotos(storage, r, inFlight)]);
    expect(uploads).toBe(1);
    expect(a.length + b.length).toBe(1);
  });
});

describe('גיבוי מקומי', () => {
  it('תמונה שכבר בענן נשמרת בגיבוי בלי base64; תמונה שעוד לא עלתה — עם', async () => {
    const { backupSnapshot } = await import('@/features/report-editor/useReportEditor');
    const r = report();
    writePhotos(r, [
      { ...makePhotoEntry('data:image/jpeg;base64,' + 'A'.repeat(1000), 'a.jpg'), cloudPath: 'rep/a.jpg' },
      { ...makePhotoEntry('data:image/jpeg;base64,BBBB', 'b.jpg'), pendingUpload: true },
    ]);
    const snap = backupSnapshot(r) as unknown as { generalPhotos: Array<{ dataUrl: string; cloudPath: string }> };
    expect(snap.generalPhotos[0]).toMatchObject({ dataUrl: '', cloudPath: 'rep/a.jpg' });
    expect(snap.generalPhotos[1].dataUrl).toContain('BBBB');
    expect((r.generalPhotos as Array<{ dataUrl: string }>)[0].dataUrl).not.toBe(''); // המקור לא משתנה
  });
});
