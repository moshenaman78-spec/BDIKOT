/**
 * components/shared-sections/CommonCards.tsx — כרטיסים שחוזרים בכל עורכי הדוחות:
 * פרטי המתקן (עמוד השער), ממצאים מסכמים, הערות, הצהרות לסוף הדוח (+ הצהרת חשמלאי לתיקון ליקוי).
 */
import { FIXED_DECLARATIONS, type ReportData } from '@/core/reportModel';
import { Card, ComboField, Field, Grid2, RoundButton, SubHead, TextAreaField } from '@/components/report-template';
import type { PhotoResolver } from '@/components/report-template/ReportDocumentView';
import type { Equipment } from '@/services/shared/testInstruments';
import { DEFECT_REPAIR_DECLARATION, readDefectRepair, writeDefectRepairField } from '@/services/shared/defectRepair';
import { LICENSE_TYPES } from '@/services/shared/electricianDeclaration';
import { ElectricianDeclarationEditor } from './ElectricianDeclarationEditor';
import { TestInstrumentsPicker } from './TestInstrumentsPicker';

export type Mutate = (fn: (draft: ReportData) => void) => void;

/** מה שהמסך מספק לכל עורך (נתונים מהענן ופעולות שתלויות בחיבור). */
export interface SharedEditorProps {
  equipment: Equipment[] | null;
  electricianHiddenGlobally: boolean;
  onAddPhotos: (files: File[]) => void;
  resolvePhoto: PhotoResolver;
  photosBusy?: boolean;
}

export const NO_SHARED: SharedEditorProps = { equipment: null, electricianHiddenGlobally: false, onAddPhotos: () => {}, resolvePhoto: () => undefined };

export function FacilityDetailsCard({ data, mutate, equipment }: { data: ReportData; mutate: Mutate; equipment: Equipment[] | null }) {
  const meta = (k: string) => String(data.meta[k] ?? '');
  const setMeta = (k: string) => (v: string) => mutate((d) => { d.meta[k] = v; });
  return (
    <Card title="פרטי המתקן (עמוד השער)" icon="🏭">
      <Grid2>
        <Field label="מזמין הבדיקה" value={meta('client')} onChange={setMeta('client')} />
        <Field label="לידי (איש קשר)" value={meta('attentionTo')} onChange={setMeta('attentionTo')} />
        <Field label="שם המתקן" value={meta('siteName')} onChange={setMeta('siteName')} />
        <Field label="מיקום המתקן" value={meta('address')} onChange={setMeta('address')} />
        <Field label="תאריך הבדיקה" type="date" value={meta('date')} onChange={setMeta('date')} />
        <Field label="תאריך הפקת הדוח" type="date" value={meta('issueDate')} onChange={setMeta('issueDate')} />
      </Grid2>
      <TextAreaField label="תיאור המתקן/העבודה" value={meta('description')} onChange={setMeta('description')} rows={2} />
      <TestInstrumentsPicker data={data} mutate={mutate} equipment={equipment} />
      <p className="sh-dim">מספר דוח: <b>{data.meta.reportNumber || '—'}</b> (נקבע ביצירה ולא משתנה)</p>
    </Card>
  );
}

export interface SummaryItem { number: number; text: string }

/** ממצאים מסכמים ממוספרים + כפתור העתקת ליקויים. */
export function SummaryItemsCard({ items, onChange, defectsCount, onCopyDefects }: {
  items: SummaryItem[]; onChange: (items: SummaryItem[]) => void; defectsCount: number; onCopyDefects: () => void;
}) {
  const renum = (xs: SummaryItem[]) => xs.map((s, i) => ({ ...s, number: i + 1 }));
  return (
    <Card title="ממצאים מסכמים" icon="📋">
      {items.map((s, i) => (
        <div className="sh-numbered" key={i}>
          <span className="sh-numbered__n">{i + 1}</span>
          <textarea className="sh-input sh-textarea" aria-label={`ממצא ${i + 1}`} value={s.text}
            onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
          <RoundButton kind="remove" label={`מחק ממצא ${i + 1}`} onClick={() => onChange(renum(items.filter((_, j) => j !== i)))} />
        </div>
      ))}
      {!items.length ? <p className="sh-dim">אין ממצאים עדיין.</p> : null}
      <div className="sh-actions">
        <RoundButton kind="add" label="הוסף ממצא" onClick={() => onChange(renum([...items, { number: 0, text: '' }]))} />
        <span className="sh-dim">הוסף ממצא</span>
        {defectsCount ? (
          <button type="button" className="sh-btn" onClick={onCopyDefects}>⤵ העתק {defectsCount} ליקויים שסומנו "לא תקין"</button>
        ) : null}
      </div>
    </Card>
  );
}

export function NotesCard({ data, mutate }: { data: ReportData; mutate: Mutate }) {
  const notes = data.notes.length ? data.notes : [''];
  return (
    <Card title="הערות" icon="📝">
      {notes.map((n, i) => (
        <div className="sh-numbered" key={i}>
          <span className="sh-numbered__n">{i + 1}</span>
          <textarea className="sh-input sh-textarea" aria-label={`הערה ${i + 1}`} value={n}
            onChange={(e) => mutate((d) => { const arr = d.notes.length ? d.notes : ['']; arr[i] = e.target.value; d.notes = arr; })} />
          <RoundButton kind="remove" label={`מחק הערה ${i + 1}`} onClick={() => mutate((d) => { d.notes = d.notes.filter((_, j) => j !== i); if (!d.notes.length) d.notes = ['']; })} />
        </div>
      ))}
      <div className="sh-actions">
        <RoundButton kind="add" label="הוסף הערה" onClick={() => mutate((d) => { d.notes = [...(d.notes.length ? d.notes : ['']), '']; })} />
        <span className="sh-dim">הוסף הערה</span>
      </div>
    </Card>
  );
}

/** הצהרות לסוף הדוח. withDefectRepair = מציגים גם "הצהרת חשמלאי לתיקון ליקוי" (כשיש ליקוי). */
export function DeclarationsCard({ data, mutate, electricianHiddenGlobally, withDefectRepair = false }: {
  data: ReportData; mutate: Mutate; electricianHiddenGlobally: boolean; withDefectRepair?: boolean;
}) {
  const dr = readDefectRepair(data);
  return (
    <Card title="הצהרות לסוף הדוח" icon="✍️">
      <SubHead>הערות בודק (קבועות, מודפסות תמיד)</SubHead>
      <ol className="sh-notes">{FIXED_DECLARATIONS.map((d) => <li key={d}>{d}</li>)}</ol>
      <TextAreaField label="הצהרה נוספת (אופציונלי)" value={String(data.customDeclaration ?? '')} onChange={(v) => mutate((d) => { d.customDeclaration = v; })} rows={2} />
      <SubHead>הצהרת החשמלאי המבצע</SubHead>
      <ElectricianDeclarationEditor data={data} mutate={mutate} hiddenGlobally={electricianHiddenGlobally} />
      {withDefectRepair ? (
        <>
          <SubHead>⚠️ זוהה ליקוי בדוח — הצהרת חשמלאי לתיקון הליקוי</SubHead>
          <p className="sh-dim">ההצהרה מודפסת אוטומטית כל עוד יש בדוח סטטוס "לא תקין" או אישור חשמול שאינו "מאושר". שדה ריק יודפס כקו למילוי ידני.</p>
          <TextAreaField label="ערוך את תוכן ההצהרה (אופציונלי)" placeholder={DEFECT_REPAIR_DECLARATION} value={dr.text} rows={3}
            onChange={(v) => mutate((d) => writeDefectRepairField(d, 'defectRepairDeclarationText', v))} />
          <Grid2>
            <Field label="שם החשמלאי שתיקן" value={dr.name} onChange={(v) => mutate((d) => writeDefectRepairField(d, 'defectRepairElectricianName', v))} />
            <Field label="מס' רישיון" inputMode="numeric" value={dr.licenseNo} onChange={(v) => mutate((d) => writeDefectRepairField(d, 'defectRepairElectricianLicenseNo', v))} />
            <ComboField label="סוג רישיון" value={dr.licenseType} options={LICENSE_TYPES} onChange={(v) => mutate((d) => writeDefectRepairField(d, 'defectRepairElectricianLicenseType', v))} />
            <Field label="תאריך התיקון" type="date" value={dr.date} onChange={(v) => mutate((d) => writeDefectRepairField(d, 'defectRepairDate', v))} />
          </Grid2>
        </>
      ) : null}
    </Card>
  );
}
