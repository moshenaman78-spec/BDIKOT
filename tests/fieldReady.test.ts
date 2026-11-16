import { describe, expect, it } from 'vitest';
import type { ReportData } from '@/core/reportModel';
import { renderReportDocument, validateReport } from '@/services/reports';
import { EMPTY_PROFILE, imagesFromReport, parseCompanyRow, profileWithReportFallback, type CompanyProfile } from '@/services/companySettingsService';
import { canUploadNow, createSignedUrlCache, safeFileName, storagePathFor, uploadPendingPhotos, type PhotoStorage } from '@/services/photoUpload';
import { APPROVAL_OPTIONS, approvalApplies, approvalTone } from '@/services/shared/approval';
import { ELECTRICIAN_DECLARATION, electricianBlock, readElectricianDeclaration } from '@/services/shared/electricianDeclaration';
import {
  addPhotoNote, effectiveNotes, makePhotoEntry, markUploaded, movePhoto, normalizePhoto, photosSection, readPhotos, removePhotoNote, setPhotoNote, writePhotos,
} from '@/services/shared/photos';
import { calibrationStatus, findMatchingEquipment, instrumentDetailsText, validateInstruments, type Equipment } from '@/services/shared/testInstruments';
import { legacyTransformerReportData } from './fixtures/legacyTransformerReport';
import { deepMergeGeneric, legacyLoad } from './legacyApp';

const report = () => legacyTransformerReportData() as unknown as ReportData;

/** שורת company_settings כפי שהישנה שומרת (saveCompanySettingsToCloud). */
const legacyCompanyRow = {
  id: 1, company_name: '', engineer_name: '', // עמודות לא בשימוש בישן
  logo_path: 'company/logo.jpg', signature_path: 'company/sig.jpg', stamp_path: '',
  settings_json: {
    companyName: 'שקד הנדסת חשמל', companyTagline: 'בדיקות חשמל', engineerName: 'משה בודק', engineerLicenseNo: '123', testerLicenseNo: '456',
    licenseType: 'בודק חשמל סוג 3', phone: '050-0000000', officePhone: '', email: 'a@b.c', companyAddress: 'חיפה', inspectorIdNumber: '', licenseValidUntil: '',
    inspectorLicensePath: 'company/lic.jpg', attachLicenseToReports: 'yes', hideElectricianDeclaration: '',
  },
};

const equipment: Equipment[] = [
  { id: 'e1', name: 'מכשיר משולב MI3155', model: 'MI3155', serialNo: '22-001', calibrationDate: '2027-03-01' },
  { id: 'e2', name: 'גשר', model: 'MI3108', serialNo: 'G-9', calibrationDate: '2026-12-01' },
  { id: 'e3', name: 'SONEL MIC-10k1', model: '', serialNo: 'S-1', calibrationDate: '2026-01-01' },
];
const today = new Date(2026, 10, 16);

describe('הגדרות חברה — פורמט הישנה', () => {
  it('נקראות מ-settings_json ומהנתיבים, לא מהעמודות', () => {
    const p = parseCompanyRow(legacyCompanyRow);
    expect(p.companyName).toBe('שקד הנדסת חשמל');
    expect(p.engineerName).toBe('משה בודק');
    expect(p.logoPath).toBe('company/logo.jpg');
    expect(p.footerLogoPath).toBe('');
    expect(p.attachLicenseToReports).toBe(true);
    expect(p.hideElectricianDeclaration).toBe(false);
    expect(parseCompanyRow(null)).toEqual(EMPTY_PROFILE);
  });
  it('נפילה להגדרות שבדוח כשהענן ריק; תמונות מהדוח רק אם data:', () => {
    const p = profileWithReportFallback(EMPTY_PROFILE, { engineerName: 'מהדוח', hideElectricianDeclaration: true });
    expect(p.engineerName).toBe('מהדוח');
    expect(p.hideElectricianDeclaration).toBe(true);
    expect(imagesFromReport({ logo: 'data:image/png;base64,AAAA', signature: 'https://signed.url/expired' })).toEqual({ logo: 'data:image/png;base64,AAAA', signature: '', footerLogo: '', inspectorLicense: '' });
  });
});

describe('עמוד שער', () => {
  const profile: CompanyProfile = parseCompanyRow(legacyCompanyRow);
  it('שורות ובסדר של buildCoverPage בישן; ריקות לא מוצגות; מספר הדוח רק בשער ובכותרת', () => {
    const d = renderReportDocument(report(), null, { company: profile, equipment, today });
    expect(d.cover!.rows.map((r) => r.label)).toEqual([
      'מזמין הבדיקה', 'לידי (איש קשר)', 'שם המתקן', 'מיקום המתקן', 'תאריך הבדיקה', 'תאריך הפקת הדוח', 'מבצע הבדיקה', 'מספר רישיון בודק', 'מספר רישיון מהנדס', 'תיאור המתקן/העבודה', 'מכשירי בדיקה',
    ]);
    const row = (l: string) => d.cover!.rows.find((r) => r.label === l)!.value;
    expect(row('תאריך הבדיקה')).toBe('1.10.2026');
    expect(row('תאריך הפקת הדוח')).toBe('16.11.2026'); // לא נקבע → היום
    expect(row('מבצע הבדיקה')).toBe('משה בודק — בודק חשמל סוג 3');
    expect(row('מכשירי בדיקה')).toBe("מכשיר משולב MI3155 — דגם MI3155 · מס' סידורי: 22-001 · תוקף כיול: 1.3.2027");
    expect(d.cover!.reportNumber).toBe('TR-1203-10-2026');
    expect(JSON.stringify(d.sections)).not.toContain('TR-1203-10-2026');
    expect(d.footerText).toBe('שקד הנדסת חשמל • משה בודק • 050-0000000 • a@b.c • חיפה');
  });
  it('בלי הגדרות חברה — שער בלי שורות בודק', () => {
    const d = renderReportDocument(report(), null, { today });
    expect(d.cover!.rows.some((r) => r.label === 'מבצע הבדיקה')).toBe(false);
  });
  it('צילום רישיון בודק כנספח אחרון רק כשמסומן בהגדרות', () => {
    const on = renderReportDocument(report(), null, { company: profile, today });
    expect(on.sections.at(-1)!.id).toBe('inspector-license');
    const off = renderReportDocument(report(), null, { company: { ...profile, attachLicenseToReports: false }, today });
    expect(off.sections.some((s) => s.id === 'inspector-license')).toBe(false);
  });
});

describe('הצהרת חשמלאי מבצע', () => {
  it('ברירת מחדל מופעלת גם בדוח ישן בלי השדה (כמו mergeDefaults בישן)', () => {
    const r = report();
    delete (r as Record<string, unknown>).showElectricianDeclaration;
    expect(readElectricianDeclaration(r).enabled).toBe(true);
  });
  it('כבויה בדוח / מבוטלת בהגדרות → לא מודפסת; נוסח ברירת מחדל כשריק', () => {
    const r = report();
    expect(electricianBlock(r, false)).toBeNull(); // בפיקסצ'ר showElectricianDeclaration=false
    r.showElectricianDeclaration = true;
    r.workingElectricianName = 'דני חשמלאי';
    const b = electricianBlock(r, false)!;
    expect(b.text).toBe(ELECTRICIAN_DECLARATION);
    expect(b.name).toBe('דני חשמלאי');
    expect(electricianBlock(r, true)).toBeNull();
  });
  it('בשער: פרטים + תאריך הבדיקה; אין חתימת בודק במשבצת החשמלאי', () => {
    const r = report();
    r.showElectricianDeclaration = true;
    r.workingElectricianLicenseNo = '777';
    const el = renderReportDocument(r, null, { today }).cover!.electrician!;
    expect(el).toEqual({ text: ELECTRICIAN_DECLARATION, name: '', licenseType: '', licenseNo: '777', date: '1.10.2026' });
    expect(Object.keys(el)).not.toContain('signature');
  });
});

describe('אישור חשמול', () => {
  it('3 אפשרויות, צבעים, ובלוק אישור תיקון רק באפשרות 2/3', () => {
    expect(approvalTone(APPROVAL_OPTIONS[0])).toBe('ok');
    expect(approvalTone(APPROVAL_OPTIONS[2])).toBe('bad');
    const r = report();
    r.approvalStatus = APPROVAL_OPTIONS[0];
    let s = renderReportDocument(r, null).sections.find((x) => x.id === 'approval')!;
    expect(s.zone).toBe('summary');
    expect(s.blocks.map((b) => b.kind)).toEqual(['banner']);
    r.approvalStatus = APPROVAL_OPTIONS[1];
    s = renderReportDocument(r, null).sections.find((x) => x.id === 'approval')!;
    expect(s.blocks.map((b) => b.kind)).toEqual(['banner', 'signoff']);
    r.approvalStatus = '';
    expect(renderReportDocument(r, null).sections.some((x) => x.id === 'approval')).toBe(false);
  });
  it('לא מודפס בסוגים המוחרגים בישן', () => {
    expect(approvalApplies('TRANSFORMER_INSPECTION')).toBe(true);
    expect(approvalApplies('HV_CABLE')).toBe(false);
    expect(approvalApplies('SOIL')).toBe(false);
  });
});

describe('תמונות', () => {
  it('רשומה חדשה במבנה makePhotoEntry של הישנה', () => {
    const p = makePhotoEntry('data:image/jpeg;base64,AA', 'a.jpg', 'image/jpeg');
    expect(Object.keys(p).sort()).toEqual(['caption', 'cloudPath', 'dataUrl', 'fileName', 'id', 'mimeType', 'notes', 'title', 'uploadedAt']);
    expect(p.id).toMatch(/^panel_/);
  });
  it('caption ישן מוצג כהערה ומומר בעריכה בלי לאבד אותו', () => {
    const old = normalizePhoto({ id: 'p1', cloudPath: 'r/x.jpg', caption: 'לוח ראשי', notes: [] });
    expect(effectiveNotes(old)).toEqual(['לוח ראשי']);
    const edited = setPhotoNote(old, 1, 'שנייה');
    expect(edited.notes).toEqual(['לוח ראשי', 'שנייה']);
    expect(edited.caption).toBe('');
    expect(addPhotoNote(old).notes).toEqual(['לוח ראשי', '']);
    expect(removePhotoNote(edited, 0).notes).toEqual(['שנייה']);
  });
  it('בדוח: רק תמונות עם מקור, מספור, הערות ריקות לא מודפסות, פרק בעמוד חדש בסוף', () => {
    const r = report();
    writePhotos(r, [
      { ...makePhotoEntry('data:image/jpeg;base64,AA', 'a.jpg'), title: 'חדר שנאים', notes: ['שלט דהוי', ' '] },
      { ...makePhotoEntry('', 'b.jpg') }, // אין מקור — לא מודפסת
      normalizePhoto({ id: 'c', cloudPath: 'rep-1/c.jpg', caption: 'מאצרה' }),
    ]);
    const s = photosSection(r)!;
    expect(s.zone).toBe('appendix');
    expect(s.pageBreakBefore).toBe(true);
    const items = (s.blocks[0] as { items: Array<{ number: number; title: string; notes: string[]; cloudPath: string }> }).items;
    expect(items.map((i) => [i.number, i.title, i.notes])).toEqual([[1, 'חדר שנאים', ['שלט דהוי']], [2, '', ['מאצרה']]]);
    const d = renderReportDocument(r, null);
    expect(d.sections.findIndex((x) => x.id === 'photos')).toBeGreaterThan(d.sections.findIndex((x) => x.id === 'signature'));
  });
  it('סידור והעלאה: markUploaded מסיר pendingUpload ושומר dataUrl', () => {
    const a = makePhotoEntry('data:a', 'a.jpg'); const b = makePhotoEntry('data:b', 'b.jpg');
    expect(movePhoto([a, b], b.id, -1).map((p) => p.id)).toEqual([b.id, a.id]);
    const up = markUploaded([{ ...a, pendingUpload: true }], a.id, 'r/a.jpg')[0];
    expect(up.cloudPath).toBe('r/a.jpg');
    expect('pendingUpload' in up).toBe(false);
    expect(up.dataUrl).toBe('data:a');
  });
  it('תמונה שנוספה בחדשה שורדת טעינה בישנה (מבנה זהה)', () => {
    const r = report();
    writePhotos(r, [{ ...makePhotoEntry('data:x', 'x.jpg'), title: 'ת', notes: ['1'], pendingUpload: true }]);
    const legacyState = legacyLoad(structuredClone(r));
    expect(legacyState.generalPhotos[0]).toMatchObject({ title: 'ת', notes: ['1'], pendingUpload: true, dataUrl: 'data:x' });
    // הישנה מנרמלת שדות של רשומת תמונה לפי makePhotoEntry בשום מקום — המבנה פשוט נשמר
    expect(deepMergeGeneric({ a: 1 }, { a: 2 })).toEqual({ a: 2 });
  });
});

describe('העלאת תמונות — מול אחסון בזיכרון (לא נוגע בענן)', () => {
  const memStorage = () => {
    const files = new Map<string, Blob>();
    const s: PhotoStorage = {
      async upload(path, blob) { if (files.has(path)) throw new Error('exists'); files.set(path, blob); return path; },
      async signedUrl(path) { return files.has(path) ? `https://signed/${path}` : null; },
    };
    return { s, files };
  };
  it('נתיב ושם קובץ כמו בישן', () => {
    expect(safeFileName('תמונה 1.jpg')).toBe('______1.jpg');
    expect(storagePathFor('rep-1', 'IMG 2.JPG', 'uuid-1')).toBe('rep-1/uuid-1-IMG_2.JPG');
  });
  it('לא מעלים לדוח שעוד לא נוצר בענן; אחרי יצירה מעלים רק ממתינות', async () => {
    const { s, files } = memStorage();
    const r = report();
    writePhotos(r, [
      { ...makePhotoEntry('data:image/jpeg;base64,QUJD', 'a.jpg'), pendingUpload: true },
      { ...makePhotoEntry('data:image/jpeg;base64,QUJD', 'b.jpg'), cloudPath: 'rep-1/old-b.jpg' },
    ]);
    r.settings.cloudInsertPending = true;
    expect(canUploadNow(r)).toBe(false);
    expect(await uploadPendingPhotos(s, r)).toEqual([]);
    r.settings.cloudInsertPending = false;
    const done = await uploadPendingPhotos(s, r);
    expect(done).toHaveLength(1);
    expect(done[0].cloudPath).toMatch(/^rep-1\/.+-a\.jpg$/);
    expect(files.size).toBe(1);
    expect(readPhotos(r)[0].pendingUpload).toBe(true); // הפונקציה לא משנה את הדוח — המסך מחיל markUploaded
  });
  it('מטמון קישורים חתומים: פג אחרי 55 דקות', async () => {
    let t = 0;
    const { s } = memStorage();
    await s.upload('p.jpg', new Blob(['x']));
    const c = createSignedUrlCache(s, () => t);
    expect(c.peek('p.jpg')).toBeUndefined();
    expect(await c.get('p.jpg')).toBe('https://signed/p.jpg');
    expect(c.peek('p.jpg')).toBe('https://signed/p.jpg');
    t = 56 * 60 * 1000;
    expect(c.peek('p.jpg')).toBeUndefined();
  });
});

describe('מכשירי בדיקה ותוקף כיול', () => {
  it('התאמה מדויקת ואז הכלה; "אחר" עם טקסט חופשי', () => {
    expect(findMatchingEquipment('גשר', equipment)?.id).toBe('e2');
    expect(findMatchingEquipment('SONEL', equipment)?.id).toBe('e3');
    expect(instrumentDetailsText('אחר', equipment, 'מד בידוד 10kV')).toBe('מד בידוד 10kV');
    expect(instrumentDetailsText('צבת זרם', equipment, '')).toBe("צבת זרם — מס' סידורי: — · תוקף כיול: —");
  });
  it('סטטוס כיול: פג / פחות מ-60 יום / תקין', () => {
    expect(calibrationStatus('2026-11-15', today)).toBe('expired');
    expect(calibrationStatus('2027-01-10', today)).toBe('warning');
    expect(calibrationStatus('2027-03-01', today)).toBe('ok');
    expect(calibrationStatus('', today)).toBeNull();
  });
  it('בדיקות לפני הפקה: כיול שפג = שגיאה, קרוב = אזהרה, בלי מכשירים = אזהרה', () => {
    const r = report();
    r.meta.testInstrumentsSelected = ['גשר', 'SONEL'];
    const issues = validateInstruments(r, equipment, today);
    expect(issues.map((i) => i.severity)).toEqual(['warning', 'error']);
    r.meta.testInstrumentsSelected = [];
    expect(validateInstruments(r, equipment, today)[0].message).toContain('לא נבחרו');
    expect(validateReport(r, { equipment, today }).some((i) => i.path === 'meta.testInstrumentsSelected')).toBe(true);
    expect(validateReport(r).some((i) => i.path === 'meta.testInstrumentsSelected')).toBe(false); // בלי רשימה — לא בודקים
  });
});
