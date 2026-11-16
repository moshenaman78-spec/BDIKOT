/**
 * services/reports/helpers.ts — אבני בניין משותפות לשירותי סוגי הדוחות.
 */
import type { Block, DocumentSection } from '@/core/reportModel';
import type { Finding } from './ReportTypeService';

export type CheckStatus = 'ok' | 'bad' | 'na' | 'pending';

export const CHECK_STATUS_LABEL: Record<CheckStatus, string> = {
  ok: 'תקין', bad: 'לא תקין', na: 'לא רלוונטי', pending: 'טרם נבדק',
};

export interface ChecklistItem {
  label: string;
  status: CheckStatus;
  note: string;
}

export function makeChecklist(labels: readonly string[]): ChecklistItem[] {
  return labels.map((label) => ({ label, status: 'pending', note: '' }));
}

export function checklistBlock(items: ChecklistItem[]): Block {
  return { kind: 'checklist', items: items.map((i) => ({ label: i.label, status: i.status, note: i.note || undefined })) };
}

export function checklistFindings(where: string, items: ChecklistItem[]): Finding[] {
  return items.filter((i) => i.status === 'bad').map((i) => ({ where, text: i.note ? `${i.label} — ${i.note}` : i.label }));
}

export interface MeasurementRow {
  label: string;
  value: string;
  unit: string;
  limit?: string;
  pass?: boolean | null;
}

export function measurementTable(caption: string, rows: MeasurementRow[]): Block {
  return {
    kind: 'table', caption,
    columns: ['בדיקה', 'ערך נמדד', 'יחידה', 'ערך סף', 'תוצאה'],
    rows: rows.map((r) => [r.label, r.value, r.unit, r.limit ?? '', r.pass == null ? '' : r.pass ? 'תקין' : 'לא תקין']),
  };
}

/** מתקן/לוח — מוצג ככרטיס כהה בעורך ובמסמך. */
export interface Facility {
  id: string;
  name: string;
  location: string;
  checklist: ChecklistItem[];
  measurements: MeasurementRow[];
  photos: Array<{ storagePath: string; caption: string }>;
  notes: string;
}

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

export function makeFacility(name = '', checklistLabels: readonly string[] = []): Facility {
  return { id: newId(), name, location: '', checklist: makeChecklist(checklistLabels), measurements: [], photos: [], notes: '' };
}

export function facilityBlock(f: Facility, fallbackName: string): Block {
  const blocks: Block[] = [];
  if (f.location) blocks.push({ kind: 'fields', rows: [{ label: 'מיקום', value: f.location }] });
  if (f.checklist.length) blocks.push(checklistBlock(f.checklist));
  if (f.measurements.length) blocks.push(measurementTable('מדידות', f.measurements));
  if (f.notes.trim()) blocks.push({ kind: 'paragraph', text: f.notes.trim() });
  if (f.photos.length) blocks.push({ kind: 'photos', perPage: 4, items: f.photos.map((ph, i) => ({ number: i + 1, title: ph.caption, dataUrl: '', cloudPath: ph.storagePath, notes: [] })) });
  return { kind: 'facility', title: f.name || fallbackName, blocks };
}

/** סעיף תוכן אחד שמכיל כרטיס לכל מתקן/לוח. */
export function facilitiesSection(id: string, title: string, icon: string, facilities: Facility[], unitName: string): DocumentSection {
  return {
    id, zone: 'content', title, icon,
    blocks: facilities.map((f, i) => facilityBlock(f, `${unitName} ${i + 1}`)),
  };
}

export function facilitiesFindings(facilities: Facility[], unitName: string): Finding[] {
  return facilities.flatMap((f, i) => {
    const where = f.name || `${unitName} ${i + 1}`;
    return [
      ...checklistFindings(where, f.checklist),
      ...f.measurements.filter((m) => m.pass === false).map((m) => ({ where, text: `${m.label}: ${m.value} ${m.unit}` })),
    ];
  });
}

export function fieldsBlock(pairs: Array<[string, string | undefined | null]>): Block {
  return { kind: 'fields', rows: pairs.filter(([, v]) => v).map(([label, value]) => ({ label, value: String(value) })) };
}
