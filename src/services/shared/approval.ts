/**
 * services/shared/approval.ts — "אישור חשמול" (state.approvalStatus בישן).
 *
 * 3 אפשרויות קבועות (APPROVAL_OPTIONS). ריק = לא מודפס. באפשרות 2 או 3 מתווסף בלוק
 * "אישור תיקון הליקויים" עם שורות ריקות לחתימת החשמלאי — כמו בישן.
 * מודפס בכל הסוגים חוץ מ: SOIL, DC_CABLE, EV_DC, MEDICAL, HV_CABLE, FLEXIBLE (וטפסים רשמיים).
 */
import type { DocumentSection, ReportData } from '@/core/reportModel';
import type { ReportTypeCode } from '@/core/reportTypes';

export const APPROVAL_OPTIONS = [
  'מתקן חשמל מאושר',
  'מתקן חשמל מאושר בכפוף לטיפול ההסתייגויות',
  'מתקן חשמל לא מאושר',
] as const;

export const APPROVAL_EXCLUDED: readonly ReportTypeCode[] = ['SOIL', 'DC_CABLE', 'EV_DC', 'MEDICAL', 'HV_CABLE', 'FLEXIBLE', 'PV_INSPECTION', 'FIRE_FORM3'];

export const REPAIR_COMMITMENT_TEXT =
  'הריני מתחייב לתקן את הליקויים האמורים לעיל ללא דיחוי ולא לחבר את המתקן לחשמל עד לביצוע התיקונים כאמור.\nהמזמין ידאג להחתמת החשמלאי.';

export function approvalApplies(code: ReportTypeCode): boolean {
  return !APPROVAL_EXCLUDED.includes(code);
}

export function readApproval(data: ReportData): string {
  return typeof data.approvalStatus === 'string' ? data.approvalStatus : '';
}

export type ApprovalTone = 'ok' | 'warn' | 'bad' | '';
export function approvalTone(value: string): ApprovalTone {
  const i = (APPROVAL_OPTIONS as readonly string[]).indexOf(value);
  return i === 0 ? 'ok' : i === 1 ? 'warn' : i === 2 ? 'bad' : '';
}

export function needsRepairCommitment(value: string): boolean {
  return value === APPROVAL_OPTIONS[1] || value === APPROVAL_OPTIONS[2];
}

export function approvalSection(data: ReportData): DocumentSection | null {
  const v = readApproval(data);
  if (!v) return null;
  return {
    id: 'approval', zone: 'summary', title: 'אישור חשמול', icon: '🔌',
    blocks: [
      { kind: 'banner', text: v, tone: approvalTone(v) || 'na' },
      ...(needsRepairCommitment(v) ? [{ kind: 'signoff' as const, title: 'אישור תיקון הליקויים ע"י חשמלאי / מבצע / מפקח', text: REPAIR_COMMITMENT_TEXT }] : []),
    ],
  };
}
