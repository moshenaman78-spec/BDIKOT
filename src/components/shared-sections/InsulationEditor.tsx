/**
 * components/shared-sections/InsulationEditor.tsx — טבלת בדיקות בידוד (DAR / PI / ערך בודד), משותפת.
 * החישוב והסיווג חיים (computeRow) — אותם ספים כמו בישן. בשיטה ידנית (ערך בודד) — סיווג ידני.
 */
import { useId } from 'react';
import {
  INSULATION_METHODS, INSULATION_ROWS, INSULATION_UNITS, MANUAL_CLASSIFICATIONS, computeRow, type InsulationTable,
} from '@/services/shared/insulation';

export function InsulationEditor({ table, onChange }: { table: InsulationTable; onChange: (fn: (t: InsulationTable) => void) => void }) {
  const id = useId();
  const method = String(table.testMethod);
  return (
    <div className="sh-ins">
      <div className="sh-field">
        <label htmlFor={id}>שיטת בדיקה</label>
        <select id={id} className="sh-select" value={method} onChange={(e) => onChange((t) => { t.testMethod = e.target.value; })}>
          {INSULATION_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <span className="sh-dim">
          {method === 'spot'
            ? 'הערך מתוקן לטמפרטורת ייחוס 20°C (התנגדות נחצית בכל 10°C עלייה) — קירוב שדה מקובל.'
            : 'הסיווג האוטומטי מבוסס על ערכי סף כלליים מקובלים — אינו מחליף שיפוט הנדסי מול תקן/מפרט ספציפי.'}
        </span>
      </div>
      {table.rows.map((r, i) => {
        const c = computeRow(method, r);
        const set = (k: string) => (v: string) => onChange((t) => { (t.rows[i] as Record<string, unknown>)[k] = v; });
        return (
          <div key={i} className={`sh-row ${c.auto?.tone === 'bad' || r.manualClassification === 'לא תקין' ? 'sh-row--bad' : ''}`}>
            <div className="sh-row__label">{INSULATION_ROWS[i]}</div>
            <div className="sh-ins__grid">
              <label className="sh-ins__cell">
                <span>{c.labels.v1}</span>
                <input className="sh-input" inputMode="decimal" dir="ltr" value={r.r15} onChange={(e) => set('r15')(e.target.value)} aria-label={`${INSULATION_ROWS[i]} — ${c.labels.v1}`} />
              </label>
              <label className="sh-ins__cell">
                <span>{c.labels.v2}</span>
                {method === 'spot'
                  ? <input className="sh-input" inputMode="decimal" dir="ltr" value={r.temp} onChange={(e) => set('temp')(e.target.value)} aria-label={`${INSULATION_ROWS[i]} — טמפרטורה`} />
                  : <input className="sh-input" inputMode="decimal" dir="ltr" value={r.r60} onChange={(e) => set('r60')(e.target.value)} aria-label={`${INSULATION_ROWS[i]} — ${c.labels.v2}`} />}
              </label>
              <label className="sh-ins__cell sh-ins__unit">
                <span>יחידה</span>
                <select className="sh-select" value={r.unit || 'MΩ'} onChange={(e) => set('unit')(e.target.value)} aria-label={`${INSULATION_ROWS[i]} — יחידה`}>
                  {INSULATION_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </label>
              <div className="sh-ins__cell">
                <span>{c.labels.ratio}</span>
                <b dir="ltr" className="sh-ins__result">{c.result}</b>
              </div>
            </div>
            <div className="sh-row__controls">
              {c.auto
                ? <span className={`sh-pill sh-pill--${c.auto.tone === 'warn' ? 'pending' : c.auto.tone}`}>{c.auto.label}</span>
                : (
                  <select className="sh-select" value={r.manualClassification} onChange={(e) => set('manualClassification')(e.target.value)} aria-label={`${INSULATION_ROWS[i]} — סיווג`}>
                    <option value="">-- סיווג --</option>
                    {MANUAL_CLASSIFICATIONS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                )}
              <input className="sh-input" placeholder="הערה" value={r.note} onChange={(e) => set('note')(e.target.value)} aria-label={`${INSULATION_ROWS[i]} — הערה`} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
