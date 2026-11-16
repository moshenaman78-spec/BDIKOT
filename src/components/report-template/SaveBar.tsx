/**
 * components/report-template/SaveBar.tsx — סרגל תחתון: מצב שמירה + שמירה + תצוגה מקדימה.
 */
import { formatLastUpdated } from '@/core/reportModel';

export function SaveBar({ status, lastSavedAt, canSave, saving, previewOn, onSave, onTogglePreview, onPrint }: {
  status: string; lastSavedAt: string | null; canSave: boolean; saving: boolean; previewOn: boolean;
  onSave: () => void; onTogglePreview: () => void; onPrint: () => void;
}) {
  return (
    <footer className="sh-savebar sh-no-print">
      <span className="sh-savebar__status" role="status">
        {status}{lastSavedAt ? ` · עודכן לאחרונה ${formatLastUpdated(lastSavedAt)}` : ''}
      </span>
      <div className="sh-savebar__btns">
        <button type="button" className="sh-btn" onClick={onTogglePreview}>{previewOn ? '✏️ עריכה' : <>👁️ <span className="sh-hide-xs">תצוגה </span>מקדימה</>}</button>
        <button type="button" className="sh-btn" onClick={onPrint}>🖨️ <span className="sh-hide-xs">הדפסה / </span>PDF</button>
        <button type="button" className="sh-btn sh-btn--primary" disabled={!canSave || saving} onClick={onSave}>{saving ? 'שומר…' : '💾 שמור'}</button>
      </div>
    </footer>
  );
}
