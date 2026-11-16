/**
 * components/report-template/ui.tsx — רכיבי UI משותפים של העיצוב החדש (עורך).
 */
import type { ReactNode } from 'react';

export function AppHeader({ title, logoSrc, status, children }: { title: string; logoSrc?: string; status?: ReactNode; children?: ReactNode }) {
  return (
    <header className="sh-header">
      <div className="sh-header__row">
        {logoSrc ? <img className="sh-header__logo" src={logoSrc} alt="שקד הנדסת חשמל" /> : <span className="bolt" aria-hidden>⚡</span>}
        <h1 className="sh-header__title">{title}</h1>
        {status ? <span className="sh-header__status" role="status">{status}</span> : null}
      </div>
      {children}
    </header>
  );
}

export interface TabDef<K extends string> { key: K; label: string; icon: string }

export function TabBar<K extends string>({ tabs, active, onChange }: { tabs: TabDef<K>[]; active: K; onChange: (k: K) => void }) {
  return (
    <nav className="sh-tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.key} type="button" role="tab" className="sh-tab" aria-selected={t.key === active} onClick={() => onChange(t.key)}>
          <span aria-hidden>{t.icon}</span>{t.label}
        </button>
      ))}
    </nav>
  );
}

export function Card({ title, icon, actions, children }: { title: string; icon?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="sh-card">
      <div className="sh-card__head">
        {icon ? <span className="sh-card__icon" aria-hidden>{icon}</span> : null}
        <h2 className="sh-card__title">{title}</h2>
        {actions ? <div className="sh-card__actions">{actions}</div> : null}
      </div>
      <div className="sh-card__body">{children}</div>
    </section>
  );
}

export function FacilityCard({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="sh-facility">
      <div className="sh-facility__head">
        <h3 className="sh-facility__title">{title}</h3>
        {subtitle ? <span className="sh-facility__subtitle">{subtitle}</span> : null}
        {actions ? <div className="sh-card__actions">{actions}</div> : null}
      </div>
      <div className="sh-facility__body">{children}</div>
    </div>
  );
}

const ROUND = { add: { icon: '+', label: 'הוספה' }, duplicate: { icon: '⧉', label: 'שכפול' }, remove: { icon: '🗑', label: 'מחיקה' } } as const;

export function RoundButton({ kind, onClick, label }: { kind: keyof typeof ROUND; onClick: () => void; label?: string }) {
  const r = ROUND[kind];
  return (
    <button type="button" className={`sh-round sh-round--${kind}`} onClick={onClick} aria-label={label ?? r.label} title={label ?? r.label}>
      <span aria-hidden>{r.icon}</span>
    </button>
  );
}

export function TextField({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  const id = `f-${label}`;
  return (
    <div className="sh-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className="sh-input" type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function SelectField({ label, value, options, onChange, placeholder = 'בחר…' }: { label: string; value: string; options: readonly string[]; onChange: (v: string) => void; placeholder?: string }) {
  const id = `s-${label}`;
  return (
    <div className="sh-field">
      <label htmlFor={id}>{label}</label>
      <select id={id} className="sh-select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

export function BigCheckbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="sh-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

type S = 'ok' | 'bad' | 'na';
const STATUS_LABEL: Record<S, string> = { ok: 'תקין', bad: 'לא תקין', na: 'לא רלוונטי' };

export function StatusPicker({ value, onChange }: { value: string; onChange: (v: S) => void }) {
  return (
    <div className="sh-status" role="group">
      {(Object.keys(STATUS_LABEL) as S[]).map((s) => (
        <button key={s} type="button" data-s={s} aria-pressed={value === s} onClick={() => onChange(s)}>{STATUS_LABEL[s]}</button>
      ))}
    </div>
  );
}
