/**
 * features/reports/SMA/SmaMaintenanceEditor.tsx — עורך דוח תחזוקה לממירי SMA / תחנות משנה.
 *
 * אותו סדר כמו הדוח המודפס: פרטי מתקן (שער) → תחנות (לוח, תאי מ"ג, שנאי, ניקיון ממיר, בידוד)
 * → ציוד בטיחות → ממסרים → תמונות → הערות → אישור → הצהרות.
 * מספר התחנות דינמי (הוספה / שכפול / מחיקה, אי אפשר למחוק את האחרונה).
 */
import { useState } from 'react';
import type { ReportData } from '@/core/reportModel';
import { Card, ChoiceChips, ComboField, FacilityCard, Field, Grid2, RoundButton, SubHead, TextAreaField, type Choice } from '@/components/report-template';
import { ProtectionRelaysEditor } from '@/components/protection-relays';
import {
  ApprovalEditor, DeclarationsCard, FacilityDetailsCard, InsulationEditor, NO_SHARED, NotesCard, PhotosEditor,
  type Mutate, type SharedEditorProps,
} from '@/components/shared-sections';
import { readTypeData, writeTypeData } from '@/services/reports/ReportTypeService';
import { relayFindings } from '@/services/shared/protectionRelays';
import {
  INVERTER_CLEANING_CHECKLIST, PANEL_CHECKLIST, SMA_OPTIONS, SMA_STATUS, TRANSFORMER_VISUAL_CHECKLIST,
  addStation, appendDefectsToNotes, cleaningTitle, collectSmaDefects, duplicateStation, inverterBrandOf, makeCell,
  markUncheckedOk, removeStation, smaService as svc, stationCode,
  type CheckItem, type SmaCell, type SmaMaintenanceReport, type SmaStation, type SmaTransformer,
} from '@/services/reports/types/sma.service';

const STATUS_CHOICES: readonly Choice[] = SMA_STATUS;

function MeasureField({ label, value, unit, units, onValue, onUnit }: {
  label: string; value: string; unit: string; units: readonly string[]; onValue: (v: string) => void; onUnit: (u: string) => void;
}) {
  return (
    <div className="sh-field">
      <label>{label}</label>
      <div className="sh-measure">
        <input className="sh-input" inputMode="decimal" dir="ltr" value={value} onChange={(e) => onValue(e.target.value)} aria-label={label} />
        <select className="sh-select" value={unit} onChange={(e) => onUnit(e.target.value)} aria-label={`${label} — יחידה`}>
          {units.map((u) => <option key={u} value={u}>{u}</option>)}
          {unit && !(units as readonly string[]).includes(unit) ? <option value={unit}>{unit}</option> : null}
        </select>
      </div>
    </div>
  );
}

function ChecklistEditor({ title, items, onChange }: { title: string; items: CheckItem[]; onChange: (items: CheckItem[]) => void }) {
  const done = items.filter((it) => it.status).length;
  const set = (i: number, patch: Partial<CheckItem>) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  return (
    <>
      <SubHead>{title} ({done}/{items.length})</SubHead>
      <div className="sh-actions">
        <button type="button" className="sh-btn" onClick={() => onChange(markUncheckedOk(items))}>✓ סמן "תקין" לכל מה שטרם נבדק</button>
      </div>
      {items.map((it, i) => (
        <div key={`${it.label}-${i}`} className={`sh-row ${it.status === 'bad' ? 'sh-row--bad' : ''}`}>
          <div className="sh-row__label">{i + 1}. {it.label}</div>
          <div className="sh-row__controls">
            <ChoiceChips ariaLabel={it.label || `פריט ${i + 1}`} value={it.status} choices={STATUS_CHOICES} onChange={(v) => set(i, { status: v })} />
            <input className="sh-input" aria-label={`הערה — ${it.label || i + 1}`} placeholder="הערה..." value={it.note} onChange={(e) => set(i, { note: e.target.value })} />
          </div>
        </div>
      ))}
    </>
  );
}

export function SmaMaintenanceEditor({ data, mutate, shared = NO_SHARED, confirm = (m) => window.confirm(m) }: {
  data: ReportData; mutate: Mutate; shared?: SharedEditorProps; confirm?: (msg: string) => boolean;
}) {
  const report = readTypeData(svc, data);
  const brand = inverterBrandOf(data);
  const upd = (fn: (d: SmaMaintenanceReport) => SmaMaintenanceReport | void) =>
    mutate((draft) => { const cur = readTypeData(svc, draft); writeTypeData(svc, draft, fn(cur) ?? cur); });
  const defects = [...collectSmaDefects(report), ...relayFindings(data)];

  return (
    <div className="sh-editor">
      <FacilityDetailsCard data={data} mutate={mutate} equipment={shared.equipment} />

      <Card title="יצרן הממיר" icon="🔌">
        <Field label="יצרן הממיר (נכנס לכותרת הדוח ולסעיף הניקיון)" value={String(data.settings.inverterBrand ?? '')}
          onChange={(v) => mutate((d) => { d.settings.inverterBrand = v; })} placeholder="SMA" />
        <p className="sh-dim">כותרת הדוח: טיפול בממירי {brand}. סעיף הניקיון: {cleaningTitle(brand)}.</p>
      </Card>

      <Card title={`תחנות / שנאים (${report.stations.length})`} icon="🔋"
        actions={<RoundButton kind="add" label="הוסף תחנה" onClick={() => upd(addStation)} />}>
        <p className="sh-dim">כל תחנה היא שנאי וממיר (TR1, TR2, …): לוח, תאי מתח גבוה, שנאי, ניקיון ממיר ובדיקת בידוד. אפשר להוסיף כמה שצריך.</p>
        {report.stations.map((st, i) => (
          <StationCard key={st.id} st={st} index={i} brand={brand}
            onChange={(fn) => upd((d) => { fn(d.stations[i]); })}
            onDuplicate={() => upd((d) => duplicateStation(d, st.id))}
            onRemove={() => {
              if (report.stations.length <= 1) { window.alert('חייבת להישאר לפחות תחנה אחת.'); return; }
              if (confirm(`למחוק את ${stationCode(st, i)}?`)) upd((d) => removeStation(d, st.id) ?? d);
            }}
          />
        ))}
      </Card>

      <Card title="ציוד בטיחות למתח גבוה" icon="🦺">
        <ChecklistEditor title="ציוד בטיחות למתח גבוה" items={report.safetyChecklist}
          onChange={(items) => upd((d) => ({ ...d, safetyChecklist: items }))} />
      </Card>

      <ProtectionRelaysEditor data={data} mutate={mutate} confirm={confirm} />

      <PhotosEditor data={data} mutate={mutate} onAddFiles={shared.onAddPhotos} resolvePhoto={shared.resolvePhoto} busy={shared.photosBusy} confirm={confirm} />
      <p className="sh-dim">התמונות מודפסות בסוף הדוח תחת "תיעוד תמונות", עם כותרת והערות 1.1 / 1.2. תנו לכותרת את שם התחנה (למשל "ממיר — ST1").</p>

      <NotesCard data={data} mutate={mutate} />
      {defects.length ? (
        <div className="sh-actions">
          <button type="button" className="sh-btn" onClick={() => mutate((d) => appendDefectsToNotes(d, [...collectSmaDefects(readTypeData(svc, d)), ...relayFindings(d)]))}>
            ⤵ העתק {defects.length} ליקויים שסומנו "לא תקין" להערות
          </button>
        </div>
      ) : null}

      <ApprovalEditor data={data} mutate={mutate} />

      <DeclarationsCard data={data} mutate={mutate} electricianHiddenGlobally={shared.electricianHiddenGlobally} />
    </div>
  );
}

function StationCard({ st, index, brand, onChange, onDuplicate, onRemove }: {
  st: SmaStation; index: number; brand: string;
  onChange: (fn: (s: SmaStation) => void) => void; onDuplicate: () => void; onRemove: () => void;
}) {
  const [open, setOpen] = useState(index === 0);
  const code = stationCode(st, index);
  const set = (k: keyof SmaStation) => (v: string) => onChange((s) => { (s as unknown as Record<string, unknown>)[k] = v; });
  const setTr = (k: keyof SmaTransformer) => (v: string) => onChange((s) => { (s.transformer as unknown as Record<string, unknown>)[k] = v; });
  return (
    <FacilityCard title={st.stationName.trim() ? `${code} — ${st.stationName.trim()}` : code}
      subtitle={[st.transformer.manufacturer, st.transformer.powerKVA && `${st.transformer.powerKVA} kVA`].filter(Boolean).join(' · ') || undefined}
      actions={<>
        <RoundButton kind="duplicate" label={`שכפל ${code}`} onClick={onDuplicate} />
        <RoundButton kind="remove" label={`מחק ${code}`} onClick={onRemove} />
        <button type="button" className="sh-btn" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? '▲ צמצם' : '▼ הרחב'}</button>
      </>}>
      {open ? (
        <>
          <Grid2>
            <Field label="סימון שנאי" value={st.code} onChange={set('code')} placeholder={`TR${index + 1}`} />
            <Field label="כינוי תחנה / ממיר (אופציונלי)" value={st.stationName} onChange={set('stationName')} placeholder="ST1" />
          </Grid2>

          <ChecklistEditor title={`בדיקה ויזואלית — לוח (${PANEL_CHECKLIST.length})`} items={st.panelChecklist}
            onChange={(items) => onChange((s) => { s.panelChecklist = items; })} />

          <SubHead>תאי מתח גבוה ({st.cells.length})</SubHead>
          <div className="sh-actions">
            <RoundButton kind="add" label="הוסף תא" onClick={() => onChange((s) => { s.cells = [...s.cells, makeCell()]; })} />
            <span className="sh-dim">הוסף תא</span>
          </div>
          {st.cells.map((c, ci) => (
            <CellEditor key={ci} c={c} index={ci}
              onChange={(fn) => onChange((s) => { fn(s.cells[ci]); })}
              onDuplicate={() => onChange((s) => { const next = [...s.cells]; next.splice(ci + 1, 0, structuredClone(s.cells[ci])); s.cells = next; })}
              onRemove={() => onChange((s) => { s.cells = s.cells.filter((_, j) => j !== ci); })}
            />
          ))}

          <SubHead>שנאי — {code}</SubHead>
          <Grid2>
            <ComboField label="תוצרת" value={st.transformer.manufacturer} options={SMA_OPTIONS.transformerManufacturer} onChange={setTr('manufacturer')} />
            <Field label="מס' יצרן" value={st.transformer.serialNo} onChange={setTr('serialNo')} />
            <Field label="שנת ייצור" inputMode="numeric" value={st.transformer.yearOfManufacture} onChange={setTr('yearOfManufacture')} />
            <Field label="הספק (kVA)" inputMode="decimal" value={st.transformer.powerKVA} onChange={setTr('powerKVA')} />
            <Field label="מתח נומינלי (kV)" value={st.transformer.nominalVoltage} onChange={setTr('nominalVoltage')} placeholder="22kV/600V" />
            <Field label="מתח קצר (%)" inputMode="decimal" value={st.transformer.shortCircuitVoltagePercent} onChange={setTr('shortCircuitVoltagePercent')} />
            <ComboField label="סדר חיבורים" value={st.transformer.connectionGroup} options={SMA_OPTIONS.connectionGroup} onChange={setTr('connectionGroup')} />
            <ComboField label="סוג" value={st.transformer.type} options={SMA_OPTIONS.transformerType} onChange={setTr('type')} />
            <Field label="דרגה" value={st.transformer.grade} onChange={setTr('grade')} />
          </Grid2>
          <ChecklistEditor title={`בדיקה ויזואלית — שנאי (${TRANSFORMER_VISUAL_CHECKLIST.length})`} items={st.transformer.checklist}
            onChange={(items) => onChange((s) => { s.transformer.checklist = items; })} />
          <TextAreaField label="הערות לשנאי" value={st.transformer.notes} onChange={setTr('notes')} rows={2} />

          <ChecklistEditor title={`${cleaningTitle(brand)} (${INVERTER_CLEANING_CHECKLIST.length})`} items={st.cleaning}
            onChange={(items) => onChange((s) => { s.cleaning = items; })} />

          <SubHead>בדיקת בידוד — שנאי</SubHead>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0' }}>
            <input type="checkbox" checked={st.insulationEnabled} onChange={(e) => onChange((s) => { s.insulationEnabled = e.target.checked; })} />
            לכלול בדיקת בידוד בתחנה הזו
          </label>
          {st.insulationEnabled ? <InsulationEditor table={st.insulation} onChange={(fn) => onChange((s) => { fn(s.insulation); })} /> : <p className="sh-dim">בלי מדידה — הסעיף לא יודפס (כמו TR3 בדוח הדוגמה).</p>}

          <TextAreaField label="הערות לתחנה" value={st.notes} onChange={set('notes')} rows={2} />
        </>
      ) : null}
    </FacilityCard>
  );
}

function CellEditor({ c, index, onChange, onDuplicate, onRemove }: {
  c: SmaCell; index: number; onChange: (fn: (c: SmaCell) => void) => void; onDuplicate: () => void; onRemove: () => void;
}) {
  const set = (k: keyof SmaCell) => (v: string) => onChange((x) => { (x as unknown as Record<string, unknown>)[k] = v; });
  const title = `תא ${c.cellNumber || index + 1}${c.cellName ? ' — ' + c.cellName : ''}`;
  return (
    <FacilityCard title={title} subtitle={[c.cellType, c.manufacturer].filter(Boolean).join(' · ') || undefined}
      actions={<>
        <RoundButton kind="duplicate" label={`שכפל תא ${index + 1}`} onClick={onDuplicate} />
        <RoundButton kind="remove" label={`מחק תא ${index + 1}`} onClick={onRemove} />
      </>}>
      <Grid2>
        <ComboField label="סוג תא" value={c.cellType} options={SMA_OPTIONS.cellType} onChange={set('cellType')} />
        <Field label="שם התא" value={c.cellName} onChange={set('cellName')} />
        <Field label="מספר תא" value={c.cellNumber} onChange={set('cellNumber')} />
        <ComboField label="יצרן" value={c.manufacturer} options={SMA_OPTIONS.manufacturer} onChange={set('manufacturer')} />
        <Field label="דגם" value={c.model} onChange={set('model')} />
        <Field label="מספר סידורי" value={c.serialNo} onChange={set('serialNo')} />
        <Field label="שנת ייצור" inputMode="numeric" value={c.yearOfManufacture} onChange={set('yearOfManufacture')} />
        <MeasureField label="מתח נקוב" value={c.ratedVoltage} unit={c.ratedVoltageUnit} units={SMA_OPTIONS.voltageUnits} onValue={set('ratedVoltage')} onUnit={set('ratedVoltageUnit')} />
        <MeasureField label="זרם נקוב" value={c.ratedCurrent} unit={c.ratedCurrentUnit} units={SMA_OPTIONS.currentUnits} onValue={set('ratedCurrent')} onUnit={set('ratedCurrentUnit')} />
        <MeasureField label="כושר ניתוק" value={c.breakingCapacity} unit={c.breakingCapacityUnit} units={SMA_OPTIONS.breakingUnits} onValue={set('breakingCapacity')} onUnit={set('breakingCapacityUnit')} />
        <ComboField label="סוג בידוד" value={c.insulationType} options={SMA_OPTIONS.insulationType} onChange={set('insulationType')} />
        <ComboField label="סוג מפסק" value={c.breakerType} options={SMA_OPTIONS.breakerType} onChange={set('breakerType')} />
        <ComboField label="סוג מנתק" value={c.disconnectorType} options={SMA_OPTIONS.disconnectorType} onChange={set('disconnectorType')} />
        <Field label="סוג הארקה" value={c.groundingType} onChange={set('groundingType')} placeholder="1x95 cu pvc" />
      </Grid2>
      <TextAreaField label="הערות לתא" value={c.notes} onChange={set('notes')} rows={2} />
    </FacilityCard>
  );
}
