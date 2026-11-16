/**
 * services/companySettingsService.ts — הגדרות חברה (שורה יחידה id=1) — מקור ל-Letterhead.
 */
import { getSupabase, TABLES } from './supabaseClient';

export interface CompanySettings {
  company_name: string;
  engineer_name: string;
  license_number: string;
  license_type: string;
  phone: string;
  email: string;
  address: string;
  website: string;
  logo_path: string;
  signature_path: string;
  stamp_path: string;
  settings_json: Record<string, unknown>;
}

export const EMPTY_COMPANY: CompanySettings = {
  company_name: 'שקד הנדסת חשמל', engineer_name: '', license_number: '', license_type: '', phone: '', email: '',
  address: '', website: '', logo_path: '', signature_path: '', stamp_path: '', settings_json: {},
};

export async function loadCompanySettings(): Promise<CompanySettings> {
  const { data, error } = await getSupabase().from(TABLES.companySettings).select('*').eq('id', 1).maybeSingle();
  if (error) throw error;
  return { ...EMPTY_COMPANY, ...(data ?? {}) } as CompanySettings;
}

export async function saveCompanySettings(s: CompanySettings): Promise<void> {
  const { error } = await getSupabase().from(TABLES.companySettings).upsert({ id: 1, ...s }, { onConflict: 'id' });
  if (error) throw error;
}
