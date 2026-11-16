/**
 * components/report-template/ConflictDialog.tsx — חלונית קונפליקט: שום אפשרות לא כותבת בלי לחיצה מפורשת.
 */
import { CONFLICT_ACTIONS, type ConflictActionId, type FieldDiff } from '@/services/sync/saveRules';

const show = (v: unknown) => (v === undefined || v === null || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));

export function ConflictDialog({ deleted, diff, busy, onAction }: {
  deleted: boolean; diff: FieldDiff[] | null; busy: boolean; onAction: (a: ConflictActionId) => void;
}) {
  return (
    <div className="sh-modal" role="dialog" aria-modal="true" aria-labelledby="sh-conflict-title">
      <div className="sh-modal__inner">
        <h3 id="sh-conflict-title">⚠️ {deleted ? 'הדוח נמחק או אורכב בענן' : 'הדוח עודכן ממכשיר אחר מאז שפתחת אותו'}</h3>
        <p className="sh-dim">השמירה שלך לא בוצעה ושום דבר לא נדרס. בחר איך להמשיך:</p>
        {CONFLICT_ACTIONS.filter((a) => !(deleted && (a.id === 'load-cloud' || a.id === 'compare'))).map((a) => (
          <button key={a.id} type="button" className={`sh-modal__btn ${a.id === 'cancel' ? 'is-cancel' : ''}`} disabled={busy} onClick={() => onAction(a.id)}>
            <b>{a.label}</b>{a.hint ? <span>{a.hint}</span> : null}
          </button>
        ))}
        {diff ? (
          diff.length ? (
            <table className="sh-table">
              <caption>שדות שונים ({diff.length})</caption>
              <thead><tr><th>שדה</th><th>אצלי</th><th>בענן</th></tr></thead>
              <tbody>{diff.slice(0, 200).map((d) => <tr key={d.path}><td dir="ltr">{d.path}</td><td>{show(d.local)}</td><td>{show(d.cloud)}</td></tr>)}</tbody>
            </table>
          ) : <p>אין הבדלים בתוכן.</p>
        ) : null}
      </div>
    </div>
  );
}
