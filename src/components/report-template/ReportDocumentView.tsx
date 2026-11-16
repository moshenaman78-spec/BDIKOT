/**
 * components/report-template/ReportDocumentView.tsx — תבנית המסמך: תצוגה מקדימה = הדפסה/PDF.
 *
 * מקבל ReportDocument (מ-renderReportDocument) — לא יודע כלום על סוג הדוח.
 * - Letterhead עם לוגו; מספר הדוח מופיע כאן בלבד (פעם אחת).
 * - "עודכן לאחרונה" כולל שעה.
 * - כותרת כל סעיף במלבן עם מספור 01, 02...; הערות ממוספרות; חתימה בסוף.
 * - טופס רשמי (טופס 3) — בלי Letterhead ובלי פוטר של החברה.
 */
import type { Block, ReportDocument } from '@/core/reportModel';
import { formatLastUpdated } from '@/core/reportModel';
import type { CompanySettings } from '@/services/companySettingsService';

const STATUS_TEXT = { ok: 'תקין', bad: 'לא תקין', na: 'לא רלוונטי', pending: 'טרם נבדק' } as const;

function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case 'fields':
      return block.rows.length ? (
        <div className="sh-kv-wrap">
          {block.caption ? <div className="sh-kv-caption">{block.caption}</div> : null}
          <dl className="sh-kv">{block.rows.map((r, i) => [<dt key={`t${i}`}>{r.label}</dt>, <dd key={`d${i}`}>{r.value}</dd>])}</dl>
        </div>
      ) : null;
    case 'table':
      return (
        <table className="sh-table">
          {block.caption ? <caption>{block.caption}</caption> : null}
          <thead><tr>{block.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>{block.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
        </table>
      );
    case 'checklist':
      return (
        <table className="sh-table">
          <thead><tr><th>#</th><th>פריט</th><th>תוצאה</th><th>הערה</th></tr></thead>
          <tbody>
            {block.items.map((it, i) => (
              <tr key={i}>
                <td>{i + 1}</td><td>{it.label}</td>
                <td><span className={`sh-pill sh-pill--${it.status}`}>{STATUS_TEXT[it.status]}</span></td>
                <td>{it.note ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    case 'paragraph':
      return <p style={{ whiteSpace: 'pre-wrap', margin: '4px 0' }}>{block.text}</p>;
    case 'notes':
      return <ol className="sh-notes">{block.items.map((n, i) => <li key={i}>{n}</li>)}</ol>;
    case 'photos':
      // TODO(photos): להחליף ב-<img> עם signedUrl (photoStorageService) — כרגע מציג כיתוב בלבד.
      return <ul>{block.items.map((p) => <li key={p.storagePath}>📷 {p.caption || p.storagePath}</li>)}</ul>;
    case 'facility':
      return (
        <div className="sh-facility">
          <div className="sh-facility__head">
            <h3 className="sh-facility__title">{block.title}</h3>
            {block.subtitle ? <span className="sh-facility__subtitle">{block.subtitle}</span> : null}
          </div>
          <div className="sh-facility__body">{block.blocks.map((b, i) => <BlockView key={i} block={b} />)}</div>
        </div>
      );
  }
}

export function Letterhead({ doc, company, logoSrc }: { doc: ReportDocument; company: CompanySettings; logoSrc?: string }) {
  const updated = formatLastUpdated(doc.lastUpdatedAt);
  return (
    <header className="sh-letterhead">
      {logoSrc ? <img className="sh-letterhead__logo" src={logoSrc} alt="" /> : null}
      <div>
        <div className="sh-letterhead__company">{company.company_name}</div>
        <div style={{ fontSize: '.82rem' }}>
          {[company.engineer_name, company.license_number && `רישיון ${company.license_number}`].filter(Boolean).join(' · ')}
        </div>
        <div style={{ fontSize: '.78rem', color: 'var(--sh-text-dim)' }}>
          {[company.phone, company.email, company.address].filter(Boolean).join(' · ')}
        </div>
      </div>
      <div className="sh-letterhead__meta">
        {doc.reportNumber ? <div><b>מספר דוח:</b> {doc.reportNumber}</div> : null}
        {doc.inspectionDate ? <div><b>תאריך בדיקה:</b> {doc.inspectionDate}</div> : null}
        {updated ? <div><b>עודכן לאחרונה:</b> {updated}</div> : null}
      </div>
    </header>
  );
}

export function ReportDocumentView({ doc, company, logoSrc }: { doc: ReportDocument; company: CompanySettings; logoSrc?: string }) {
  const official = doc.documentKind === 'official-form';
  return (
    <article className="sh-doc" dir="rtl" lang="he">
      {official ? null : <Letterhead doc={doc} company={company} logoSrc={logoSrc} />}
      <h1 className="sh-doc__title">{doc.title}</h1>
      {doc.sections.map((s) => (
        <section key={s.id} className="sh-sec" data-zone={s.zone}>
          <h2 className="sh-sec__title">
            {s.number ? <span className="sh-sec__num">{s.number}</span> : null}
            {s.icon ? <span aria-hidden>{s.icon}</span> : null}
            {s.title}
          </h2>
          {s.zone === 'signature' ? (
            <div className="sh-signature">
              <div>{company.engineer_name || 'שם הבודק'}</div>
              <div>חתימה וחותמת</div>
              <div>תאריך</div>
            </div>
          ) : (
            s.blocks.map((b, i) => <BlockView key={i} block={b} />)
          )}
        </section>
      ))}
      {official ? null : (
        <footer className="sh-doc__footer">
          <span>{company.company_name}</span>
          <span>{doc.title}</span>
        </footer>
      )}
    </article>
  );
}
