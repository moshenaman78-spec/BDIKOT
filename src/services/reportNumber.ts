/**
 * services/reportNumber.ts — מספר דוח: PREFIX-מונה-MM-YYYY (למשל HV-1064-08-2026).
 *
 * מונה: קודם RPC אטומי בשרת (get_next_report_number); נפילה למונה מקומי (מתחיל ב-1000)
 * רק במצב לא-מקוון. המספר מוקצה לפני INSERT ולא משתנה לעולם אחרי היצירה.
 */
import { getReportType, type ReportTypeCode } from '@/core/reportTypes';
import type { ReportStore } from './sync/reportStore';

export function sanitizeBrandForPrefix(brand: string | undefined): string {
  const cleaned = (brand ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 10);
  return cleaned || 'SMA';
}

export function reportNumberPrefix(code: ReportTypeCode, inverterBrand?: string): string {
  if (code === 'SMA') return sanitizeBrandForPrefix(inverterBrand || 'SMA');
  return getReportType(code).numberPrefix;
}

export function formatReportNumber(prefix: string, counter: number, now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${prefix}-${counter}-${month}-${now.getFullYear()}`;
}

export interface LocalCounter {
  get(): number | null;
  set(v: number): void;
}

export const localStorageCounter: LocalCounter = {
  get() {
    try {
      const v = parseInt(localStorage.getItem('report-counter') ?? '', 10);
      return Number.isNaN(v) ? null : v;
    } catch {
      return null;
    }
  },
  set(v) {
    try { localStorage.setItem('report-counter', String(v)); } catch { /* לא קריטי */ }
  },
};

export async function nextReportNumber(
  store: ReportStore,
  code: ReportTypeCode,
  opts: { inverterBrand?: string; local?: LocalCounter; now?: Date } = {},
): Promise<string> {
  let counter = await store.nextReportCounter();
  if (counter === null) {
    const local = opts.local ?? localStorageCounter;
    counter = Math.max(999, local.get() ?? 999) + 1;
    local.set(counter);
  }
  return formatReportNumber(reportNumberPrefix(code, opts.inverterBrand), counter, opts.now);
}
