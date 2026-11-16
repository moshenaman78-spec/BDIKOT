/**
 * components/report-template/ConflictDialog.tsx — חלונית קונפליקט: שום אפשרות לא כותבת בלי לחיצה מפורשת.
 * "השווה שינויים" מוצג כרשימה קריאה (תווית בעברית, "אצלי" מול "בענן") — מתאים גם לטלפון.
 */
import { CONFLICT_ACTIONS, type ConflictActionId, type FieldDiff } from '@/services/sync/saveRules';
import { readableDiff } from '@/services/sync/diffLabels';

const KIND_NOTE = { changed: '', 'added-here': 'קיים רק אצלי', 'only-in-cloud': 'קיים רק בענן' } as const;

export function ConflictDialog({ deleted, diff, busy, onAction }: {
  deleted: boolean; diff: FieldDiff[] | null; busy: boolean; onAction: (a: ConflictActionId) => void;
}) {
  const rows = diff ? readableDiff(diff) : null;
  return (
    <div className="sh-modal" role="dialog" aria-modal="true" aria-labelledby="sh-conflict-title">
      <div className="sh-modal__inner">
        <h3 id="sh-conflict-title">⚠️ {deleted ? 'הדוח נמחק או אורכב בענן' : 'הדוח עודכן ממכשיר אחר מאז שפתחת אותו'}</h3>
        <p className="sh-dim">
          השמירה שלך לא בוצעה ושום דבר לא נדרס. השינויים שלך שמורים במכשיר.
          {deleted ? ' אפשר לשמור את הגרסה שלך כדוח חדש.' : ' בחר איך להמשיך:'}
        </p>
        {CONFLICT_ACTIONS.filter((a) => !(deleted && (a.id === 'load-cloud' || a.id === 'compare'))).map((a) => (
          <button key={a.id} type="button" className={`sh-modal__btn ${a.id === 'cancel' ? 'is-cancel' : ''}`} disabled={busy} onClick={() => onAction(a.id)}>
            <b>{a.label}</b>
            {a.id === 'cancel'
              ? <span>השמירה האוטומטית תושהה עד שתלחץ "שמור" ותבחר מה לעשות.</span>
              : a.hint ? <span>{a.hint}{a.id === 'load-cloud' ? ' (עותק של הגרסה שלך נשמר במכשיר כגיבוי.)' : ''}</span> : null}
          </button>
        ))}
        {busy ? <p className="sh-dim" role="status">מעבד…</p> : null}
        {rows ? (
          rows.length ? (
            <div className="sh-diff">
              <div className="sh-diff__title">שדות שונים ({rows.length})</div>
              <ul>
                {rows.slice(0, 200).map((r, i) => (
                  <li key={i}>
                    <div className="sh-diff__label">{r.label}{KIND_NOTE[r.kind] ? <span className="sh-dim"> · {KIND_NOTE[r.kind]}</span> : null}</div>
                    <div className="sh-diff__vals">
                      <span><b>אצלי:</b> {r.local}</span>
                      <span><b>בענן:</b> {r.cloud}</span>
                    </div>
                  </li>
                ))}
              </ul>
              {rows.length > 200 ? <p className="sh-dim">ועוד {rows.length - 200} שדות…</p> : null}
            </div>
          ) : <p>אין הבדלים בתוכן.</p>
        ) : null}
      </div>
    </div>
  );
}
