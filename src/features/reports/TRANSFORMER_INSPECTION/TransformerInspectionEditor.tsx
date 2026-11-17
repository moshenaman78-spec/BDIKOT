/**
 * features/reports/TRANSFORMER_INSPECTION/TransformerInspectionEditor.tsx — עורך דוח בדיקת שנאי מתח גבוה.
 *
 * אותם סעיפים ושדות כמו renderTransformerInspectionReportCards בישן, בעיצוב החדש:
 *   01 פרטי המתקן · 02 שנאים (כרטיס כהה לכל שנאי) · 03 ממצאים מסכמים · 04 מסקנה · הערות · הערות בודק
 * כל שינוי נכתב ישירות ל-report_data.transformerInspectionReport (המפתח של האפליקציה הישנה).
 */
import { useState } from 'react';
import type { ReportData } from '@/core/reportModel';
import {
  BigCheckbox, Card, ChoiceChips, ComboField, FacilityCard, Field, Grid2, RoundButton, SubHead, TextAreaField, type Choice,
} from '@/components/report-template';
import { ProtectionRelaysEditor } from '@/components/protection-relays';
import {
  ApprovalEditor, DeclarationsCard, FacilityDetailsCard, NO_SHARED, NotesCard, PhotosEditor, SummaryItemsCard, type Mutate, type SharedEditorProps,
} from '@/components/shared-sections';
import { readTypeData, writeTypeData } from '@/services/reports/ReportTypeService';
import { relayFindings } from '@/services/shared/protectionRelays';
import {
  TI_CHECKLIST, TI_INSULATION_TESTS, TI_OPTIONS, addTransformer, appendDefectsToSummary, collectDefects, duplicateTransformer,
  removeTransformer, transformerInspectionService as svc, transformerTitle,
  type GroundingBlock, type TransformerInspectionReport, type TransformerItem,
} from '@/services/reports/types/transformerInspection.service';

const STATUS_CHOICES: readonly Choice[] = [
  { value: 'V', label: 'תקין', tone: 'ok' },
  { value: 'X', label: 'לא תקין', tone: 'bad' },
  { value: 'N/A', label: 'לא רלוונטי', tone: 'na' },
];
const CONCLUSION_CHOICES: readonly Choice[] = [
  { value: 'תקין', label: 'תקין', tone: 'ok' },
  { value: 'לא תקין', label: 'לא תקין', tone: 'bad' },
];


export function TransformerInspectionEditor({ data, mutate, shared = NO_SHARED, confirm = (m) => window.confirm(m), notify = (m) => window.alert(m) }: {
  data: ReportData; mutate: Mutate; shared?: SharedEditorProps; confirm?: (msg: string) => boolean; notify?: (msg: string) => void;
}) {
  const ti = readTypeData(svc, data);
  const updTi = (fn: (d: TransformerInspectionReport) => TransformerInspectionReport | void) =>
    mutate((draft) => {
      const cur = readTypeData(svc, draft);
      writeTypeData(svc, draft, fn(cur) ?? cur);
    });
  const updTr = (id: string, fn: (t: TransformerItem) => void) =>
    updTi((d) => { const t = d.transformers.find((x) => x.id === id); if (t) fn(t); });
  const defects = [...collectDefects(ti), ...relayFindings(data)];

  return (
    <div className="sh-editor">
      <FacilityDetailsCard data={data} mutate={mutate} equipment={shared.equipment} />

      <Card title="שנאים" icon="🔋" actions={<RoundButton kind="add" label="הוסף שנאי" onClick={() => updTi(addTransformer)} />}>
        {ti.transformers.map((t, i) => (
          <TransformerCard
            key={t.id} t={t} index={i}
            onChange={(fn) => updTr(t.id, fn)}
            onDuplicate={() => updTi((d) => duplicateTransformer(d, t.id))}
            onRemove={() => {
              if (ti.transformers.length <= 1) { notify('לא ניתן למחוק את השנאי האחרון — חייב להישאר לפחות שנאי אחד. ניתן לערוך את פרטיו או לשכפל ממנו שנאי חדש.'); return; }
              if (confirm('האם למחוק את השנאי הזה, כולל כל פרטיו?')) updTi((d) => removeTransformer(d, t.id) ?? d);
            }}
          />
        ))}
      </Card>

      <ProtectionRelaysEditor data={data} mutate={mutate} confirm={confirm} />

      <PhotosEditor data={data} mutate={mutate} onAddFiles={shared.onAddPhotos} resolvePhoto={shared.resolvePhoto} busy={shared.photosBusy} confirm={confirm} />

      <SummaryItemsCard
        items={ti.summaryItems} defectsCount={defects.length}
        onChange={(items) => updTi((d) => ({ ...d, summaryItems: items }))}
        onCopyDefects={() => { const extra = relayFindings(data); updTi((d) => appendDefectsToSummary(d, extra)); }}
      />

      <Card title="מסקנה" icon="✅">
        <ChoiceChips ariaLabel="מסקנה" value={ti.conclusion.status} choices={CONCLUSION_CHOICES} onChange={(v) => updTi((d) => { d.conclusion.status = v; })} />
        <TextAreaField label="הרחבה / הערות נוספות (אופציונלי)" value={ti.conclusion.freeText} onChange={(v) => updTi((d) => { d.conclusion.freeText = v; })} />
      </Card>

      <ApprovalEditor data={data} mutate={mutate} />

      <NotesCard data={data} mutate={mutate} />

      <DeclarationsCard data={data} mutate={mutate} electricianHiddenGlobally={shared.electricianHiddenGlobally} />
    </div>
  );
}

function GroundingFields({ title, g, onChange }: { title: string; g: GroundingBlock; onChange: (k: keyof GroundingBlock, v: string) => void }) {
  return (
    <>
      <SubHead>{title}</SubHead>
      <Grid2>
        <Field label="מוליכים במקביל" value={g.parallelConductors} onChange={(v) => onChange('parallelConductors', v)} />
        <Field label='חתך מוליך (ממ"ר)' inputMode="decimal" value={g.crossSection} onChange={(v) => onChange('crossSection', v)} />
      </Grid2>
      <Field label="סוג מוליך" value={g.conductorType} onChange={(v) => onChange('conductorType', v)} />
    </>
  );
}

function TransformerCard({ t, index, onChange, onDuplicate, onRemove }: {
  t: TransformerItem; index: number; onChange: (fn: (t: TransformerItem) => void) => void; onDuplicate: () => void; onRemove: () => void;
}) {
  const [open, setOpen] = useState(true);
  const set = (k: keyof TransformerItem) => (v: string) => onChange((x) => { (x as Record<string, unknown>)[k] = v; });
  const done = t.checklist.filter((c) => c.status).length;
  const bad = t.checklist.filter((c) => c.status === 'X').length;
  return (
    <FacilityCard
      title={transformerTitle(t, index)}
      subtitle={[t.manufacturer, t.powerKVA && `${t.powerKVA} kVA`, t.checklistEnabled ? `${done}/${TI_CHECKLIST.length} נבדקו${bad ? ` · ${bad} לא תקין` : ''}` : ''].filter(Boolean).join(' · ')}
      actions={<>
        <RoundButton kind="duplicate" label="שכפל שנאי" onClick={onDuplicate} />
        <RoundButton kind="remove" label="מחק שנאי" onClick={onRemove} />
        <button type="button" className="sh-btn" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? '▲ צמצם' : '▼ הרחב'}</button>
      </>}
    >
      {open ? (
        <>
          <SubHead>פרטי שנאי</SubHead>
          <Grid2>
            <Field label="מספר סידורי" value={t.serialNo} onChange={set('serialNo')} />
            <Field label="דגם" value={t.model} onChange={set('model')} />
            <ComboField label="יצרן" value={t.manufacturer} options={TI_OPTIONS.manufacturer} onChange={set('manufacturer')} />
            <Field label="הספק (kVA)" inputMode="decimal" value={t.powerKVA} onChange={set('powerKVA')} />
            <ComboField label="מתח ראשוני (kV)" value={t.primaryVoltageKV} options={TI_OPTIONS.primaryVoltage} onChange={set('primaryVoltageKV')} />
            <ComboField label="מתח משני (V)" value={t.secondaryVoltageV} options={TI_OPTIONS.secondaryVoltage} onChange={set('secondaryVoltageV')} />
            <ComboField label="קבוצת חיבור" value={t.connectionGroup} options={TI_OPTIONS.connectionGroup} onChange={set('connectionGroup')} />
            <Field label="שנת ייצור" inputMode="numeric" value={t.yearOfManufacture} onChange={set('yearOfManufacture')} />
            <ComboField label="סוג שנאי" value={t.transformerType} options={TI_OPTIONS.type} onChange={set('transformerType')} />
            <Field label="דרגת מתח קצר Uk%" inputMode="decimal" value={t.shortCircuitVoltagePercent} onChange={set('shortCircuitVoltagePercent')} />
          </Grid2>

          <GroundingFields title="הארקת שיטה" g={t.groundingMethod} onChange={(k, v) => onChange((x) => { x.groundingMethod[k] = v; })} />
          <GroundingFields title="הארקת הגנה" g={t.groundingProtection} onChange={(k, v) => onChange((x) => { x.groundingProtection[k] = v; })} />

          <SubHead>
            <BigCheckbox label={`בדיקות ויזואליות (${done}/${TI_CHECKLIST.length})`} checked={t.checklistEnabled} onChange={(v) => onChange((x) => { x.checklistEnabled = v; })} />
          </SubHead>
          {t.checklistEnabled ? (
            <>
              <div className="sh-actions">
                <button type="button" className="sh-btn" onClick={() => onChange((x) => { x.checklist.forEach((c) => { if (!c.status) c.status = 'V'; }); })}>
                  ✓ סמן "תקין" לכל מה שטרם נבדק
                </button>
              </div>
              {TI_CHECKLIST.map((label, ci) => {
                const c = t.checklist[ci];
                return (
                  <div key={ci} className={`sh-row ${c.status === 'X' ? 'sh-row--bad' : ''}`}>
                    <div className="sh-row__label">{ci + 1}. {label}</div>
                    <div className="sh-row__controls">
                      <ChoiceChips ariaLabel={label} value={c.status} choices={STATUS_CHOICES} onChange={(v) => onChange((x) => { x.checklist[ci].status = v; })} />
                      <input className="sh-input" aria-label={`הערות — ${label}`} placeholder="הערות..." value={c.notes}
                        onChange={(e) => onChange((x) => { x.checklist[ci].notes = e.target.value; })} />
                    </div>
                  </div>
                );
              })}
            </>
          ) : null}

          <SubHead>
            <BigCheckbox label="בדיקת בידוד שנאי" checked={t.insulationEnabled} onChange={(v) => onChange((x) => { x.insulationEnabled = v; })} />
          </SubHead>
          {t.insulationEnabled ? TI_INSULATION_TESTS.map((def, ii) => {
            const r = t.insulationTests[ii];
            return (
              <div key={def.key} className={`sh-row ${r.enabled && r.status === 'X' ? 'sh-row--bad' : ''}`}>
                <BigCheckbox label={def.label} checked={r.enabled} onChange={(v) => onChange((x) => { x.insulationTests[ii].enabled = v; })} />
                {r.enabled ? (
                  <div className="sh-row__controls">
                    <ChoiceChips ariaLabel={def.label} value={r.status} choices={STATUS_CHOICES} onChange={(v) => onChange((x) => { x.insulationTests[ii].status = v; })} />
                    <input className="sh-input" inputMode="decimal" aria-label={`ערך — ${def.label}`} placeholder="ערך (MΩ)" value={r.value}
                      onChange={(e) => onChange((x) => { x.insulationTests[ii].value = e.target.value; })} />
                  </div>
                ) : null}
              </div>
            );
          }) : null}

          <TextAreaField label="הערות לשנאי" value={t.sectionNotes} onChange={set('sectionNotes')} rows={2} />
        </>
      ) : null}
    </FacilityCard>
  );
}
