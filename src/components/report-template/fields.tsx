/**
 * components/report-template/fields.tsx — שדות עריכה נוספים לעורכי הדוחות.
 */
import { useId, type ReactNode } from 'react';

export function TextAreaField({ label, value, onChange, rows = 3, placeholder }: { label: string; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  const id = useId();
  return (
    <div className="sh-field">
      <label htmlFor={id}>{label}</label>
      <textarea id={id} className="sh-input sh-textarea" rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/** רשימת בחירה + ערך חופשי (selectWithCustom בישן) — datalist. */
export function ComboField({ label, value, options, onChange, inputMode }: {
  label: string; value: string; options: readonly string[]; onChange: (v: string) => void; inputMode?: 'text' | 'decimal' | 'numeric';
}) {
  const id = useId();
  return (
    <div className="sh-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className="sh-input" list={`${id}-list`} value={value} inputMode={inputMode} onChange={(e) => onChange(e.target.value)} placeholder="בחר או הקלד…" />
      <datalist id={`${id}-list`}>{options.map((o) => <option key={o} value={o} />)}</datalist>
    </div>
  );
}

export function Field({ label, value, onChange, inputMode, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; inputMode?: 'text' | 'decimal' | 'numeric'; type?: string; placeholder?: string;
}) {
  const id = useId();
  return (
    <div className="sh-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className="sh-input" type={type} inputMode={inputMode} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
        autoComplete={type === 'password' ? 'current-password' : type === 'email' ? 'email' : undefined}
        dir={type === 'email' || type === 'password' ? 'ltr' : undefined} />
    </div>
  );
}

export interface Choice { value: string; label: string; tone: 'ok' | 'bad' | 'na' }

/** כפתורי בחירה גדולים (סטטוס). לחיצה שנייה על הנבחר מבטלת את הבחירה. */
export function ChoiceChips({ value, choices, onChange, ariaLabel }: { value: string; choices: readonly Choice[]; onChange: (v: string) => void; ariaLabel?: string }) {
  return (
    <div className="sh-status" role="group" aria-label={ariaLabel}>
      {choices.map((c) => (
        <button key={c.value} type="button" data-s={c.tone} aria-pressed={value === c.value} onClick={() => onChange(value === c.value ? '' : c.value)}>
          {c.label}
        </button>
      ))}
    </div>
  );
}

export function Grid2({ children }: { children: ReactNode }) {
  return <div className="sh-grid2">{children}</div>;
}

export function SubHead({ children }: { children: ReactNode }) {
  return <div className="sh-subhead">{children}</div>;
}
