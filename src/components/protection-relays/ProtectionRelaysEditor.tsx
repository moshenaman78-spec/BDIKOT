/**
 * components/protection-relays/ProtectionRelaysEditor.tsx — כרטיס "ממסרי הגנה", משותף ל-SMA / שנאי / לוח ראשי.
 *
 * אותם שדות כמו renderProtectionRelaysCard בישן, בעיצוב החדש: כרטיס כהה לכל ממסר, הוספה לפי דגם,
 * שכפול/מחיקה/צמצום, מתגי DIP בלחיצה (מתג 1 משמאל, כמו על הממסר). כותב ל-report_data.protectionRelays.
 */
import { useId } from 'react';
import type { ReportData } from '@/core/reportModel';
import { Card, ChoiceChips, FacilityCard, Field, Grid2, RoundButton, SubHead, type Choice } from '@/components/report-template';
import {
  OTHER_MODEL, RELAY_LIBRARY, RELAY_MODEL_NAMES, addRelay, duplicateRelay, fieldKey, isSelect, libraryFor, readRelays, relayDipBits,
  relaySelectOptions, relaySummaryLine, relayTitle, removeRelay, toggleDip, writeRelays, type ProtectionRelay, type RelayField,
} from '@/services/shared/protectionRelays';

type Mutate = (fn: (draft: ReportData) => void) => void;
type Group = 'info' | 'settings' | 'extra';

const STATUS_CHOICES: readonly Choice[] = [
  { value: 'תקין', label: 'תקין', tone: 'ok' },
  { value: 'לא תקין', label: 'לא תקין', tone: 'bad' },
  { value: 'לא נבדק', label: 'לא נבדק', tone: 'na' },
];

export function ProtectionRelaysEditor({ data, mutate, title = 'ממסרי הגנה', confirm = (m) => window.confirm(m) }: {
  data: ReportData; mutate: Mutate; title?: string; confirm?: (msg: string) => boolean;
}) {
  const relays = readRelays(data);
  const updList = (fn: (list: ProtectionRelay[]) => ProtectionRelay[]) => mutate((d) => writeRelays(d, fn(readRelays(d))));
  const updRelay = (i: number, fn: (r: ProtectionRelay) => ProtectionRelay | void) =>
    updList((list) => list.map((r, j) => (j === i ? (fn(r) ?? r) : r)));

  return (
    <Card title={`${title}${relays.length ? ` (${relays.length})` : ''}`} icon="🛡">
      <p className="sh-dim">
        לכל לוח / תא / ממיר — בוחרים את דגם הממסר ומזינים את נתוניו, הגדרותיו ומצב מתגי ה-DIP.
        דגמים זמינים: {RELAY_MODEL_NAMES.filter((m) => m !== OTHER_MODEL).join(', ')} + אחר.
      </p>
      {relays.map((r, i) => (
        <RelayCard
          key={r.id + i} r={r} index={i}
          onChange={(fn) => updRelay(i, fn)}
          onDuplicate={() => updList((l) => duplicateRelay(l, i))}
          onRemove={() => { if (confirm(`למחוק את ממסר #${i + 1} (${r.model})?`)) updList((l) => removeRelay(l, i)); }}
        />
      ))}
      <div className="sh-actions">
        {RELAY_MODEL_NAMES.map((m) => (
          <span key={m} className="sh-add-chip">
            <RoundButton kind="add" label={`הוסף ממסר ${m}`} onClick={() => updList((l) => addRelay(l, m))} />
            <span>{m}</span>
          </span>
        ))}
      </div>
    </Card>
  );
}

function RelayFieldInput({ group, field, r, onChange }: { group: Group; field: RelayField; r: ProtectionRelay; onChange: (fn: (r: ProtectionRelay) => ProtectionRelay) => void }) {
  const [k, label, spec] = field;
  const key = fieldKey(k);
  const value = r[group][key] ?? '';
  const set = (v: string) => onChange((x) => ({ ...x, [group]: { ...x[group], [key]: v } }));
  const id = useId();
  if (spec === 'select:status') {
    return (
      <div className="sh-field">
        <label id={id}>{label}</label>
        <ChoiceChips ariaLabel={label} value={value} choices={STATUS_CHOICES} onChange={set} />
      </div>
    );
  }
  if (isSelect(spec)) {
    const opts = relaySelectOptions(spec!);
    if (value && !opts.includes(value)) opts.push(value); // ערך קיים שלא ברשימה — לא נאבד (כמו hvSelect)
    return (
      <div className="sh-field">
        <label htmlFor={id}>{label}</label>
        <select id={id} className="sh-select" value={value} onChange={(e) => set(e.target.value)}>
          <option value="">— בחר —</option>
          {opts.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }
  return <Field label={spec ? `${label} (${spec})` : label} value={value} onChange={set} />;
}

function RelayCard({ r, index, onChange, onDuplicate, onRemove }: {
  r: ProtectionRelay; index: number; onChange: (fn: (r: ProtectionRelay) => ProtectionRelay | void) => void; onDuplicate: () => void; onRemove: () => void;
}) {
  const lib = libraryFor(r.model);
  const known = !!RELAY_LIBRARY[r.model];
  const modelId = useId();
  return (
    <FacilityCard
      title={`${index + 1}. 🛡 ${relayTitle(r)}`}
      subtitle={r.collapsed ? relaySummaryLine(r) : lib.maker || undefined}
      actions={<>
        <RoundButton kind="duplicate" label={`שכפל ממסר ${index + 1}`} onClick={onDuplicate} />
        <RoundButton kind="remove" label={`מחק ממסר ${index + 1}`} onClick={onRemove} />
        <button type="button" className="sh-btn" aria-expanded={!r.collapsed} onClick={() => onChange((x) => ({ ...x, collapsed: !x.collapsed }))}>
          {r.collapsed ? '▼ הרחב' : '▲ צמצם'}
        </button>
      </>}
    >
      {r.collapsed ? null : (
        <>
          <Grid2>
            <div className="sh-field">
              <label htmlFor={modelId}>דגם הממסר</label>
              <select id={modelId} className="sh-select" value={r.model} onChange={(e) => onChange((x) => ({ ...x, model: e.target.value }))}>
                {RELAY_MODEL_NAMES.map((m) => <option key={m} value={m}>{m}</option>)}
                {known ? null : <option value={r.model}>{r.model} (לא מוכר)</option>}
              </select>
              <span className="sh-dim">{lib.desc}</span>
            </div>
            <Field label="מיקום — לוח / תא / ממיר" placeholder="למשל: מסדר מ״ג ראשי — תא 3" value={r.location} onChange={(v) => onChange((x) => ({ ...x, location: v }))} />
          </Grid2>

          <SubHead>פרטי הממסר</SubHead>
          <Grid2>{lib.info.map((f) => <RelayFieldInput key={f[0]} group="info" field={f} r={r} onChange={onChange} />)}</Grid2>

          <SubHead>הגדרות הגנה</SubHead>
          <Grid2>{lib.settings.map((f) => <RelayFieldInput key={f[0]} group="settings" field={f} r={r} onChange={onChange} />)}</Grid2>

          {lib.dips.length ? (
            <>
              <SubHead>מצב מתגי DIP (לחיצה = ON/OFF)</SubHead>
              {lib.dips.map(([k, label, n]) => {
                const bits = relayDipBits(r.dips[k], n);
                return (
                  <div key={k} className="sh-dip">
                    <div className="sh-dip__label">{label}</div>
                    <div className="sh-dip__row" dir="ltr" role="group" aria-label={label}>
                      {bits.split('').map((b, bi) => (
                        <button key={bi} type="button" className={`sh-dip__sw ${b === '1' ? 'is-on' : ''}`} aria-pressed={b === '1'}
                          aria-label={`${label} מתג ${bi + 1}`} title={`מתג ${bi + 1}: ${b === '1' ? 'ON' : 'OFF'}`}
                          onClick={() => onChange((x) => toggleDip(x, k, bi, n))}>
                          <span>{bi + 1}</span><i aria-hidden />
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          ) : null}

          <SubHead>בדיקות</SubHead>
          {lib.extra.map((f) => <RelayFieldInput key={f[0]} group="extra" field={f} r={r} onChange={onChange} />)}
          <Field label="הערות" value={r.notes} onChange={(v) => onChange((x) => ({ ...x, notes: v }))} />
        </>
      )}
    </FacilityCard>
  );
}
