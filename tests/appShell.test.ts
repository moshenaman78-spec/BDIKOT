import { describe, expect, it } from 'vitest';
import { authErrorText } from '@/features/report-editor/useCloud';
import { LEGACY_APP_URL, SUPABASE_ANON_KEY, SUPABASE_URL } from '@/config';
import { MIGRATED_TYPES } from '@/features/report-screen/editors';
import { demoReport } from '@/features/report-screen/ReportScreen';
import { renderReportDocument, validateReport } from '@/services/reports';
import manifest from '../public/manifest.webmanifest?raw';

describe('התחברות', () => {
  it('שגיאות Supabase Auth בעברית', () => {
    expect(authErrorText('Invalid login credentials')).toBe('אימייל או סיסמה שגויים');
    expect(authErrorText('Email not confirmed')).toContain('לא אושרה');
    expect(authErrorText('Failed to fetch')).toContain('אין חיבור');
    expect(authErrorText('משהו אחר')).toBe('משהו אחר');
  });
});

describe('הגדרות', () => {
  it('ברירת מחדל: פרויקט האפליקציה הקיימת ומפתח anon (לא service_role)', () => {
    expect(SUPABASE_URL).toBe('https://mbpiifsoeamdqntlzdgu.supabase.co');
    const payload = JSON.parse(Buffer.from(SUPABASE_ANON_KEY.split('.')[1], 'base64url').toString());
    expect(payload).toMatchObject({ ref: 'mbpiifsoeamdqntlzdgu', role: 'anon' });
    expect(LEGACY_APP_URL).toBe('https://shked.vercel.app/');
  });
});

describe('סוגים שהועברו', () => {
  it('שנאי מתח גבוה ולוח חשמל ראשי; הדגמה של כל אחד נבנית ונבדקת', () => {
    expect(MIGRATED_TYPES).toEqual(['TRANSFORMER_INSPECTION', 'MAIN_PANEL']);
    for (const code of MIGRATED_TYPES) {
      const d = demoReport(code);
      expect(renderReportDocument(d, null).typeCode).toBe(code);
      expect(Array.isArray(validateReport(d))).toBe(true);
    }
  });
});

describe('PWA', () => {
  it('manifest: scope ו-start_url ב-/app/, אייקונים 192/512 + maskable, RTL', () => {
    const m = JSON.parse(manifest);
    expect(m).toMatchObject({ start_url: '/app/', scope: '/app/', display: 'standalone', dir: 'rtl', lang: 'he' });
    const sizes = m.icons.map((i: { sizes: string; purpose: string }) => `${i.sizes}:${i.purpose}`);
    expect(sizes).toEqual(['192x192:any', '512x512:any', '512x512:maskable']);
  });
});
