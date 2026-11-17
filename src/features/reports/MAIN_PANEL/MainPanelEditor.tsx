/**
 * features/reports/MAIN_PANEL/MainPanelEditor.tsx — עורך דוח בדיקת לוח חשמל ראשי.
 *
 * אותם שדות כמו renderMainPanelReportCards בישן, בעיצוב החדש:
 * פרטי המתקן · מסדר מתח גבוה (פרטים, 3 משני זרם, בדיקה ויזואלית עם הערה לכל פריט) · תאי מתח גבוה ·
 * בדיקות בידוד · ממסרי הגנה · תמונות · ממצאים מסכמים · אישור חשמול · הערות · הצהרות (+ תיקון ליקוי).
 * כל שינוי נכתב ל-report_data.mainPanelReport (ול-itemNotes להערות פריטים) — המפתחות של הישנה.
 */
import { useState } from 'react';
import type { ReportData } from '@/core/reportModel';
import { Card, ChoiceChips, ComboField, FacilityCard, Field, Grid2, RoundButton, SubHead, TextAreaField, type Choice } from '@/components/report-template';
import { ProtectionRelaysEditor } from '@/components/protection-relays';
import {
  ApprovalEditor, DeclarationsCard, FacilityDetailsCard, InsulationEditor, NO_SHARED, NotesCard, PhotosEditor, SummaryItemsCard,
  type Mutate, type SharedEditorProps,
} from '@/components/shared-sections';
import { readTypeData, writeTypeData } from '@/services/reports/ReportTypeService';
import { relayFindings } from '@/services/shared/protectionRelays';
import {
  MAIN_SWITCHGEAR_CHECKLIST, MP_OPTIONS, SWITCHGEAR_STATUS, appendDefectsToSummary, cellTitle, collectMainPanelDefects, duplicateCell,
  hasMainPanelDefect, itemNoteKey, makeHvCell, mainPanelService as svc, readItemNotes, writeItemNote,
  type AssemblyDetails, type HvCell, type MainPanelReport,
} from '@/services/reports/types/mainPanel.service';

const STATUS_CHOICES: readonly Choice[] = SWITCHGEAR_STATUS;

/** ערך + יחידה (evDcMeasurementField בישן). */
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
          {unit && !units.includes(unit) ? <option value={unit}>{unit}</option> : null}
        </select>
      </div>
    </div>
  );
}

export function MainPanelEditor({ data, mutate, shared = NO_SHARED, confirm = (m) => window.confirm(m) }: {
  data: ReportData; mutate: Mutate; shared?: SharedEditorProps; confirm?: (msg: string) => boolean;
}) {
  const mp = readTypeData(svc, data);
  const upd = (fn: (d: MainPanelReport) => MainPanelReport | void) =>
    mutate((draft) => { const cur = readTypeData(svc, draft); writeTypeData(svc, draft, fn(cur) ?? cur); });
  const ad = mp.mainSwitchgear.assemblyDetails;
  const setAd = (k: keyof AssemblyDetails) => (v: string) => upd((d) => { (d.mainSwitchgear.assemblyDetails as Record<string, unknown>)[k] = v; });
  const setCt = (group: 'measurementCT' | 'protectionCT' | 'summaryCT', k: string) => (v: string) =>
    upd((d) => { (d.mainSwitchgear.assemblyDetails[group] as unknown as Record<string, string>)[k] = v; });
  const notes = readItemNotes(data);
  const defects = [...collectMainPanelDefects(mp, data), ...relayFindings(data)];
  const done = MAIN_SWITCHGEAR_CHECKLIST.filter((_, i) => mp.mainSwitchgear.checklist[String(i)]).length;

  return (
    <div className="sh-editor">
      <FacilityDetailsCard data={data} mutate={mutate} equipment={shared.equipment} />

      <Card title={`מסדר מתח גבוה${ad.name ? ' — ' + ad.name : ''}`} icon="🗄️">
        <SubHead>פרטי מסדר מתח גבוה</SubHead>
        <Field label="שם המסדר" value={ad.name} onChange={setAd('name')} />
        <Grid2>
          <ComboField label="יצרן" value={ad.manufacturer} options={MP_OPTIONS.switchgearManufacturer} onChange={setAd('manufacturer')} />
          <Field label="דגם" value={ad.model} onChange={setAd('model')} />
          <Field label="מספר סידורי" value={ad.serialNo} onChange={setAd('serialNo')} />
          <Field label="שנת ייצור" inputMode="numeric" value={ad.yearOfManufacture} onChange={setAd('yearOfManufacture')} />
          <MeasureField label="מתח נקוב" value={ad.ratedVoltage} unit={ad.ratedVoltageUnit} units={MP_OPTIONS.voltageUnits} onValue={setAd('ratedVoltage')} onUnit={setAd('ratedVoltageUnit')} />
          <MeasureField label="זרם נקוב" value={ad.ratedCurrent} unit={ad.ratedCurrentUnit} units={MP_OPTIONS.currentUnits} onValue={setAd('ratedCurrent')} onUnit={setAd('ratedCurrentUnit')} />
          <MeasureField label="כושר ניתוק" value={ad.breakingCapacity} unit={ad.breakingCapacityUnit} units={MP_OPTIONS.breakingUnits} onValue={setAd('breakingCapacity')} onUnit={setAd('breakingCapacityUnit')} />
          <Field label="מספר תאים" inputMode="numeric" value={ad.numberOfCells} onChange={setAd('numberOfCells')} />
          <ComboField label="סוג בידוד" value={ad.insulationType} options={MP_OPTIONS.insulationType} onChange={setAd('insulationType')} />
          <Field label="תקן" value={ad.standard} onChange={setAd('standard')} />
          <Field label="מיקום התקנה" value={ad.installLocation} onChange={setAd('installLocation')} />
        </Grid2>
        <TextAreaField label="הערות למסדר" value={ad.notes} onChange={setAd('notes')} rows={2} />

        <SubHead>משנה זרם מדידה</SubHead>
        <Grid2>
          {([['type', 'סוג'], ['model', 'דגם'], ['va', 'הספק (VA)'], ['alf', 'ALF'], ['cls', 'CLASS'], ['ratio', 'יחס זרם']] as const).map(([k, l]) => (
            <Field key={k} label={l} value={ad.measurementCT[k]} onChange={setCt('measurementCT', k)} />
          ))}
        </Grid2>
        <SubHead>משנה זרם הגנה</SubHead>
        <Grid2>
          {([['manufacturer', 'יצרן'], ['model', 'דגם'], ['serialNo', 'מספר סידורי'], ['secondaryCurrent', 'זרם משני (A)']] as const).map(([k, l]) => (
            <Field key={k} label={l} value={ad.protectionCT[k]} onChange={setCt('protectionCT', k)} />
          ))}
        </Grid2>
        <Field label="עמידות פסי צבירה בזרם קצר" placeholder="לדוגמה: 25kA - FLR, IAC-A, 1sec" value={ad.protectionCT.busbarWithstand} onChange={setCt('protectionCT', 'busbarWithstand')} />
        <SubHead>משנה זרם מסכם</SubHead>
        <Grid2>
          {([['type', 'סוג'], ['model', 'דגם'], ['va', 'הספק (VA)'], ['alf', 'ALF'], ['ratio', 'יחס זרם']] as const).map(([k, l]) => (
            <Field key={k} label={l} value={ad.summaryCT[k]} onChange={setCt('summaryCT', k)} />
          ))}
        </Grid2>

        <SubHead>בדיקה ויזואלית — מסדר ({done}/{MAIN_SWITCHGEAR_CHECKLIST.length})</SubHead>
        <div className="sh-actions">
          <button type="button" className="sh-btn" onClick={() => upd((d) => { MAIN_SWITCHGEAR_CHECKLIST.forEach((_, i) => { if (!d.mainSwitchgear.checklist[String(i)]) d.mainSwitchgear.checklist[String(i)] = 'ok'; }); })}>
            ✓ סמן "תקין" לכל מה שטרם נבדק
          </button>
        </div>
        {MAIN_SWITCHGEAR_CHECKLIST.map((label, i) => {
          const st = mp.mainSwitchgear.checklist[String(i)] ?? '';
          return (
            <div key={i} className={`sh-row ${st === 'bad' ? 'sh-row--bad' : ''}`}>
              <div className="sh-row__label">{i + 1}. {label}</div>
              <div className="sh-row__controls">
                <ChoiceChips ariaLabel={label} value={st} choices={STATUS_CHOICES} onChange={(v) => upd((d) => { d.mainSwitchgear.checklist[String(i)] = v; })} />
                <input className="sh-input" aria-label={`הערה — ${label}`} placeholder="הערה..." value={notes[itemNoteKey(i)] ?? ''}
                  onChange={(e) => mutate((d) => writeItemNote(d, i, e.target.value))} />
              </div>
            </div>
          );
        })}
        <TextAreaField label="פרטי תאים וציוד (יצרן, דגם, מתח/זרם נומינלי...)" value={mp.mainSwitchgear.cabinetDetails} onChange={(v) => upd((d) => { d.mainSwitchgear.cabinetDetails = v; })} rows={2} />
        <TextAreaField label="הערות" value={mp.mainSwitchgear.notes} onChange={(v) => upd((d) => { d.mainSwitchgear.notes = v; })} rows={2} />
      </Card>

      <Card title={`תאי מתח גבוה${mp.hvCells.length ? ` (${mp.hvCells.length})` : ''}`} icon="🔌"
        actions={<RoundButton kind="add" label="הוסף תא מתח גבוה" onClick={() => upd((d) => { d.hvCells.push(makeHvCell()); })} />}>
        {mp.hvCells.length ? null : <p className="sh-dim">אין תאים עדיין — לחץ על + להוספת תא.</p>}
        {mp.hvCells.map((c, i) => (
          <CellCard key={i} c={c} index={i}
            onChange={(fn) => upd((d) => { fn(d.hvCells[i]); })}
            onDuplicate={() => upd((d) => ({ ...d, hvCells: duplicateCell(d.hvCells, i) }))}
            onRemove={() => { if (confirm(`למחוק את ${cellTitle(c, i)}?`)) upd((d) => ({ ...d, hvCells: d.hvCells.filter((_, j) => j !== i) })); }}
          />
        ))}
      </Card>

      <Card title="בדיקות בידוד" icon="⚡">
        <InsulationEditor table={mp.insulationTests} onChange={(fn) => upd((d) => { fn(d.insulationTests); })} />
      </Card>

      <ProtectionRelaysEditor data={data} mutate={mutate} confirm={confirm} />

      <PhotosEditor data={data} mutate={mutate} onAddFiles={shared.onAddPhotos} resolvePhoto={shared.resolvePhoto} busy={shared.photosBusy} confirm={confirm} />

      <SummaryItemsCard
        items={mp.summaryItems} defectsCount={defects.length}
        onChange={(items) => upd((d) => ({ ...d, summaryItems: items }))}
        onCopyDefects={() => upd((d) => appendDefectsToSummary(d, defects))}
      />

      <ApprovalEditor data={data} mutate={mutate} />

      <NotesCard data={data} mutate={mutate} />

      <DeclarationsCard data={data} mutate={mutate} electricianHiddenGlobally={shared.electricianHiddenGlobally} withDefectRepair={hasMainPanelDefect(mp, data)} />
    </div>
  );
}

function CellCard({ c, index, onChange, onDuplicate, onRemove }: {
  c: HvCell; index: number; onChange: (fn: (c: HvCell) => void) => void; onDuplicate: () => void; onRemove: () => void;
}) {
  const [open, setOpen] = useState(true);
  const set = (k: keyof HvCell) => (v: string) => onChange((x) => { (x as Record<string, unknown>)[k] = v; });
  return (
    <FacilityCard title={cellTitle(c, index)} subtitle={[c.cellType, c.manufacturer].filter(Boolean).join(' · ') || undefined}
      actions={<>
        <RoundButton kind="duplicate" label={`שכפל תא ${index + 1}`} onClick={onDuplicate} />
        <RoundButton kind="remove" label={`מחק תא ${index + 1}`} onClick={onRemove} />
        <button type="button" className="sh-btn" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? '▲ צמצם' : '▼ הרחב'}</button>
      </>}>
      {open ? (
        <>
          <Grid2>
            <ComboField label="סוג התא" value={c.cellType} options={MP_OPTIONS.cellType} onChange={set('cellType')} />
            <Field label="שם התא" value={c.cellName} onChange={set('cellName')} />
            <Field label="מספר התא" value={c.cellNumber} onChange={set('cellNumber')} />
            <ComboField label="יצרן" value={c.manufacturer} options={MP_OPTIONS.switchgearManufacturer} onChange={set('manufacturer')} />
            <Field label="דגם" value={c.model} onChange={set('model')} />
            <Field label="מספר סידורי" value={c.serialNo} onChange={set('serialNo')} />
            <Field label="שנת ייצור" inputMode="numeric" value={c.yearOfManufacture} onChange={set('yearOfManufacture')} />
            <MeasureField label="מתח נקוב" value={c.ratedVoltage} unit={c.ratedVoltageUnit} units={MP_OPTIONS.voltageUnits} onValue={set('ratedVoltage')} onUnit={set('ratedVoltageUnit')} />
            <MeasureField label="זרם נקוב" value={c.ratedCurrent} unit={c.ratedCurrentUnit} units={MP_OPTIONS.currentUnits} onValue={set('ratedCurrent')} onUnit={set('ratedCurrentUnit')} />
            <MeasureField label="כושר ניתוק" value={c.breakingCapacity} unit={c.breakingCapacityUnit} units={MP_OPTIONS.breakingUnits} onValue={set('breakingCapacity')} onUnit={set('breakingCapacityUnit')} />
            <ComboField label="סוג בידוד" value={c.insulationType} options={MP_OPTIONS.insulationType} onChange={set('insulationType')} />
            <ComboField label="סוג מפסק" value={c.breakerType} options={MP_OPTIONS.breakerType} onChange={set('breakerType')} />
            <ComboField label="סוג מנתק" value={c.disconnectorType} options={MP_OPTIONS.disconnectorType} onChange={set('disconnectorType')} />
            <Field label="סוג הארקה" value={c.groundingType} onChange={set('groundingType')} />
            <ComboField label="ממסר הגנה" value={c.protectionRelay} options={MP_OPTIONS.protectionRelay} onChange={set('protectionRelay')} />
            <Field label="CT" value={c.ct} onChange={set('ct')} />
            <Field label="VT" value={c.vt} onChange={set('vt')} />
          </Grid2>
          <TextAreaField label="תיאור התא" value={c.description} onChange={set('description')} rows={2} />
          <TextAreaField label="הערות" value={c.notes} onChange={set('notes')} rows={2} />
        </>
      ) : null}
    </FacilityCard>
  );
}
