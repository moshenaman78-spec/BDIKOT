/**
 * components/report-template/ReportDocumentView.tsx — תבנית המסמך: תצוגה מקדימה = הדפסה/PDF.
 *
 * מקבל ReportDocument (מ-renderReportDocument) — לא יודע כלום על סוג הדוח.
 * - עמוד שער (עמוד 1): לוגו, כותרת, מספר דוח (פעם אחת בלבד), טבלת פרטים, הצהרת חשמלאי מבצע, חתימת הבודק.
 * - פוטר בכל עמוד בהדפסה: לוגו תחתון, פרטי החברה, חתימה — כמו buildFooterHtml בישן.
 * - כותרת כל סעיף במלבן עם מספור 01, 02...; הערות ממוספרות; חתימה; נספחים (תמונות, רישיון).
 * - טופס רשמי (טופס 3) — בלי עמוד שער ובלי פוטר של החברה.
 * תמונות: data: URL מועדף; תמונת ענן נפתרת דרך resolvePhoto (קישור חתום / נתונים שהורדו).
 */
import type { Block, CoverPage, PhotoItem, ReportDocument } from '@/core/reportModel';
import { formatLastUpdated } from '@/core/reportModel';
import { EMPTY_IMAGES, type CompanyImages } from '@/services/companySettingsService';

const STATUS_TEXT = { ok: 'תקין', bad: 'לא תקין', na: 'לא רלוונטי', pending: 'טרם נבדק' } as const;
const BLANK = '____________________';

export type PhotoResolver = (cloudPath: string) => string | undefined;

interface Ctx { images: CompanyImages; resolvePhoto: PhotoResolver }

function photoSrc(p: PhotoItem, resolve: PhotoResolver): string {
  return p.dataUrl || (p.cloudPath ? resolve(p.cloudPath) ?? '' : '');
}

function PhotoBox({ p, ctx, solo }: { p: PhotoItem; ctx: Ctx; solo: boolean }) {
  const src = photoSrc(p, ctx.resolvePhoto);
  return (
    <figure className={`sh-photo ${solo ? 'is-solo' : ''}`}>
      {src ? <img src={src} alt={p.title || `תמונה ${p.number}`} /> : <div className="sh-photo__missing">התמונה נטענת מהענן…</div>}
      <figcaption>
        <div className="sh-photo__title">{p.title ? `תמונה ${p.number} - ${p.title}` : `תמונה ${p.number}`}</div>
        {p.notes.map((n, i) => <div key={i} className="sh-photo__note"><b>{p.number}.{i + 1}</b> {n}</div>)}
      </figcaption>
    </figure>
  );
}

function PhotoGrid({ items, perPage, ctx }: { items: PhotoItem[]; perPage: number; ctx: Ctx }) {
  // עד perPage תמונות בעמוד; כל "עמוד" הוא בלוק שלא נשבר; 2 בשורה; תמונה אחרונה בודדת ברוחב מלא
  const pages: PhotoItem[][] = [];
  for (let i = 0; i < items.length; i += perPage) pages.push(items.slice(i, i + perPage));
  return (
    <>
      {pages.map((page, pi) => (
        <div key={pi} className={`sh-photo-page ${pi > 0 ? 'is-next' : ''}`}>
          {page.map((p, i) => <PhotoBox key={p.number} p={p} ctx={ctx} solo={page.length % 2 === 1 && i === page.length - 1} />)}
        </div>
      ))}
    </>
  );
}

function SignoffLines({ withDate = true }: { withDate?: boolean }) {
  return (
    <table className="sh-table sh-signoff__table">
      <thead><tr><th>שם החשמלאי</th><th>סוג רישיון</th><th>מס' רישיון</th>{withDate ? <th>תאריך</th> : null}</tr></thead>
      <tbody><tr><td>{BLANK}</td><td>{BLANK}</td><td>{BLANK}</td>{withDate ? <td>{BLANK}</td> : null}</tr></tbody>
    </table>
  );
}

function BlockView({ block, ctx }: { block: Block; ctx: Ctx }) {
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
          <tbody>{block.rows.map((r, i) => <tr key={i}>{r.map((c, j) => block.ltrColumns?.includes(j) ? <td key={j} dir="ltr" className="sh-ltr">{c}</td> : <td key={j}>{c}</td>)}</tr>)}</tbody>
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
      return <PhotoGrid items={block.items} perPage={block.perPage} ctx={ctx} />;
    case 'banner':
      return <div className={`sh-banner sh-banner--${block.tone}`}>{block.text}</div>;
    case 'signoff':
      return (
        <div className="sh-signoff">
          <div className="sh-signoff__title">{block.title}</div>
          <p style={{ whiteSpace: 'pre-wrap' }}>{block.text}</p>
          <SignoffLines withDate={false} />
          <div className="sh-signoff__line">חתימה: {BLANK} &nbsp; תאריך: {BLANK} &nbsp; כתובת: {BLANK}</div>
        </div>
      );
    case 'image': {
      const src = ctx.images[block.imageKey];
      return src ? (
        <figure className="sh-fullimage">
          {block.caption ? <figcaption>{block.caption}</figcaption> : null}
          <img src={src} alt={block.caption || ''} />
        </figure>
      ) : <p className="sh-dim">התמונה לא זמינה (לא נטענה מהגדרות החברה).</p>;
    }
    case 'facility':
      return (
        <div className="sh-facility">
          <div className="sh-facility__head">
            <h3 className="sh-facility__title">{block.title}</h3>
            {block.subtitle ? <span className="sh-facility__subtitle">{block.subtitle}</span> : null}
          </div>
          <div className="sh-facility__body">{block.blocks.map((b, i) => <BlockView key={i} block={b} ctx={ctx} />)}</div>
        </div>
      );
  }
}

export function CoverPageView({ cover, images, lastUpdatedAt }: { cover: CoverPage; images: CompanyImages; lastUpdatedAt: string | null }) {
  const updated = formatLastUpdated(lastUpdatedAt);
  const el = cover.electrician;
  return (
    <section className="sh-cover" aria-label="עמוד שער">
      {images.logo ? <div className="sh-cover__letterhead"><img src={images.logo} alt="לוגו" /></div> : null}
      <h1 className="sh-cover__title">{cover.title}</h1>
      {cover.reportNumber ? <div className="sh-cover__number">מספר דו"ח: {cover.reportNumber}</div> : null}
      <table className="sh-cover__table">
        <tbody>
          {cover.rows.map((r) => <tr key={r.label}><th scope="row">{r.label}:</th><td>{r.value}</td></tr>)}
          {updated ? <tr><th scope="row">עודכן לאחרונה:</th><td>{updated}</td></tr> : null}
        </tbody>
      </table>
      <div className="sh-cover__bottom">
        {el ? (
          <div className="sh-signoff">
            <div className="sh-signoff__title">הצהרת החשמלאי המבצע</div>
            <p>{el.text}</p>
            <table className="sh-table sh-signoff__table">
              <thead><tr><th>שם החשמלאי</th><th>סוג רישיון</th><th>מס' רישיון</th><th>תאריך</th></tr></thead>
              <tbody><tr><td>{el.name || BLANK}</td><td>{el.licenseType || BLANK}</td><td>{el.licenseNo || BLANK}</td><td>{el.date || BLANK}</td></tr></tbody>
            </table>
            <div className="sh-signoff__line">חתימת החשמלאי: {BLANK}</div>
          </div>
        ) : null}
        <div className="sh-cover__sig">
          {images.signature ? <img src={images.signature} alt="חתימה וחותמת" /> : <div className="sh-signoff__line">חתימה וחותמת: {BLANK}</div>}
          {cover.inspectorName ? <div className="sh-dim">{cover.inspectorName}</div> : null}
        </div>
      </div>
    </section>
  );
}

export function ReportDocumentView({ doc, images = EMPTY_IMAGES, resolvePhoto = () => undefined }: {
  doc: ReportDocument; images?: CompanyImages; resolvePhoto?: PhotoResolver;
}) {
  const ctx: Ctx = { images, resolvePhoto };
  const official = doc.documentKind === 'official-form';
  return (
    <article className="sh-doc" dir="rtl" lang="he">
      {/* מסגרת הדפסה: tfoot חוזר בכל עמוד ושומר מקום לפוטר הקבוע — כך הפוטר לא מכסה תוכן */}
      <table className="sh-print-frame" role="presentation"><tbody><tr><td>
      {doc.cover ? <CoverPageView cover={doc.cover} images={images} lastUpdatedAt={doc.lastUpdatedAt} /> : <h1 className="sh-doc__title">{doc.title}</h1>}
      {doc.sections
        // נספח תמונה בלי תמונה זמינה — לא מדפיסים עמוד ריק
        .filter((s) => !(s.blocks.length === 1 && s.blocks[0].kind === 'image' && !images[s.blocks[0].imageKey]))
        .map((s) => (
          <section key={s.id} className={`sh-sec ${s.pageBreakBefore ? 'is-page-break' : ''}`} data-zone={s.zone}>
            <h2 className="sh-sec__title">
              {s.number ? <span className="sh-sec__num">{s.number}</span> : null}
              {s.icon ? <span aria-hidden>{s.icon}</span> : null}
              {s.title}
            </h2>
            {s.zone === 'signature' ? (
              <div className="sh-signature">
                <div>
                  {images.signature ? <img className="sh-signature__img" src={images.signature} alt="חתימה וחותמת" /> : null}
                  <span>{doc.cover?.inspectorName || 'שם הבודק'} — חתימה וחותמת</span>
                </div>
                <div><span>תאריך</span></div>
              </div>
            ) : (
              s.blocks.map((b, i) => <BlockView key={i} block={b} ctx={ctx} />)
            )}
          </section>
        ))}
      </td></tr></tbody>
      {official ? null : <tfoot><tr><td><div className="sh-print-footer-space" /></td></tr></tfoot>}
      </table>
      {official ? null : (
        <footer className="sh-print-footer" aria-hidden>
          {images.footerLogo ? <img className="sh-print-footer__logo" src={images.footerLogo} alt="" /> : null}
          <span className="sh-print-footer__text">{doc.footerText}</span>
          {images.signature ? <img className="sh-print-footer__sig" src={images.signature} alt="" /> : null}
        </footer>
      )}
    </article>
  );
}

/** ממתין שכל התמונות במסמך ייטענו — לפני window.print(), כדי שלא תודפס תמונה חסרה. */
export async function waitForImages(root: ParentNode = document, timeoutMs = 15000): Promise<void> {
  const imgs = Array.from(root.querySelectorAll<HTMLImageElement>('.sh-doc img'));
  const all = Promise.all(imgs.map((img) => (img.complete ? Promise.resolve() : img.decode().catch(() => undefined))));
  await Promise.race([all, new Promise((r) => setTimeout(r, timeoutMs))]);
}
