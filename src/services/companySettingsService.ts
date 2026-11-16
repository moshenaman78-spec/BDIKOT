/**
 * services/companySettingsService.ts — הגדרות חברה (שורה יחידה id=1) — מקור לעמוד השער, לפוטר ולחתימה.
 *
 * קריאה בלבד. הפורמט הוא של האפליקציה הישנה (applyCloudCompanySettings / saveCompanySettingsToCloud):
 *   - settings_json: companyName, companyTagline, engineerName, engineerLicenseNo, testerLicenseNo,
 *     licenseType, phone, officePhone, email, companyAddress, inspectorIdNumber, licenseValidUntil,
 *     inspectorLicensePath, attachLicenseToReports ('yes'/''), hideElectricianDeclaration ('yes'/'')
 *   - logo_path / signature_path / stamp_path (= לוגו תחתון): נתיבים בדלי report-files
 * עמודות company_name / engineer_name וכו' בטבלה לא בשימוש בישן ולכן לא נקראות כאן.
 *
 * עריכת ההגדרות נשארת באפליקציה הישנה (מסך "הגדרות חברה") — האפליקציה החדשה לא כותבת לשורה הזו.
 */
import { BUCKETS, getSupabase, TABLES } from './supabaseClient';

export interface CompanyProfile {
  companyName: string;
  companyTagline: string;
  engineerName: string;
  engineerLicenseNo: string;
  testerLicenseNo: string;
  licenseType: string;
  phone: string;
  officePhone: string;
  email: string;
  companyAddress: string;
  inspectorIdNumber: string;
  licenseValidUntil: string;
  /** נתיבים בדלי report-files ('' = אין). */
  logoPath: string;
  signaturePath: string;
  footerLogoPath: string;
  inspectorLicensePath: string;
  attachLicenseToReports: boolean;
  hideElectricianDeclaration: boolean;
}

/** תמונות מוכנות להצגה/הדפסה — data: URL (לא תלוי ברשת או בתוקף קישור). */
export interface CompanyImages {
  logo: string;
  signature: string;
  footerLogo: string;
  inspectorLicense: string;
}

export const EMPTY_PROFILE: CompanyProfile = {
  companyName: '', companyTagline: '', engineerName: '', engineerLicenseNo: '', testerLicenseNo: '', licenseType: '',
  phone: '', officePhone: '', email: '', companyAddress: '', inspectorIdNumber: '', licenseValidUntil: '',
  logoPath: '', signaturePath: '', footerLogoPath: '', inspectorLicensePath: '', attachLicenseToReports: false, hideElectricianDeclaration: false,
};
export const EMPTY_IMAGES: CompanyImages = { logo: '', signature: '', footerLogo: '', inspectorLicense: '' };

const TEXT_FIELDS = [
  'companyName', 'companyTagline', 'engineerName', 'engineerLicenseNo', 'testerLicenseNo', 'licenseType', 'phone', 'officePhone',
  'email', 'companyAddress', 'inspectorIdNumber', 'licenseValidUntil',
] as const;

const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));

/** שורת company_settings (כפי שהישנה שומרת) → פרופיל. טהור — נבדק בבדיקות. */
export function parseCompanyRow(row: Record<string, unknown> | null | undefined): CompanyProfile {
  if (!row) return { ...EMPTY_PROFILE };
  const sj = (row.settings_json && typeof row.settings_json === 'object' ? row.settings_json : {}) as Record<string, unknown>;
  const p: CompanyProfile = { ...EMPTY_PROFILE };
  for (const f of TEXT_FIELDS) p[f] = str(sj[f]);
  p.logoPath = str(row.logo_path);
  p.signaturePath = str(row.signature_path);
  p.footerLogoPath = str(row.stamp_path);
  p.inspectorLicensePath = str(sj.inspectorLicensePath);
  p.attachLicenseToReports = sj.attachLicenseToReports === 'yes';
  p.hideElectricianDeclaration = sj.hideElectricianDeclaration === 'yes';
  return p;
}

/**
 * כשאין חיבור/שורה בענן: הדוח עצמו מחזיק עותק של הגדרות החברה ב-report_data.settings
 * (הישנה שומרת את state.settings כולו). שדה ריק בענן נופל לערך מהדוח.
 */
export function profileWithReportFallback(cloud: CompanyProfile, reportSettings: Record<string, unknown>): CompanyProfile {
  const p = { ...cloud };
  for (const f of TEXT_FIELDS) if (!p[f]) p[f] = str(reportSettings[f]);
  if (!cloud.attachLicenseToReports && reportSettings.attachLicenseToReports === true) p.attachLicenseToReports = true;
  if (!cloud.hideElectricianDeclaration && reportSettings.hideElectricianDeclaration === true) p.hideElectricianDeclaration = true;
  return p;
}

/** תמונות מהדוח עצמו (data: URL בלבד — קישורים חתומים ישנים פגי תוקף לא שימושיים). */
export function imagesFromReport(reportSettings: Record<string, unknown>): CompanyImages {
  const d = (v: unknown) => (typeof v === 'string' && v.startsWith('data:') ? v : '');
  return { logo: d(reportSettings.logo), signature: d(reportSettings.signature), footerLogo: d(reportSettings.footerLogo), inspectorLicense: d(reportSettings.inspectorLicense) };
}

export async function loadCompanyProfile(): Promise<CompanyProfile> {
  const { data, error } = await getSupabase().from(TABLES.companySettings).select('settings_json, logo_path, signature_path, stamp_path').eq('id', 1).maybeSingle();
  if (error) throw error;
  return parseCompanyRow(data as Record<string, unknown> | null);
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** מוריד קובץ מהדלי (קריאה בלבד) ומחזיר data: URL — כמו התיקון בישן v2.368 (לא תלוי בתוקף קישור בהדפסה). */
export async function storageImageAsDataUrl(path: string): Promise<string> {
  if (!path) return '';
  const { data, error } = await getSupabase().storage.from(BUCKETS.reportFiles).download(path);
  if (error || !data) return '';
  return blobToDataUrl(data);
}

export async function loadCompanyImages(p: CompanyProfile): Promise<CompanyImages> {
  const [logo, signature, footerLogo, inspectorLicense] = await Promise.all([
    storageImageAsDataUrl(p.logoPath), storageImageAsDataUrl(p.signaturePath), storageImageAsDataUrl(p.footerLogoPath),
    p.attachLicenseToReports ? storageImageAsDataUrl(p.inspectorLicensePath) : Promise.resolve(''),
  ]);
  return { logo, signature, footerLogo, inspectorLicense };
}
