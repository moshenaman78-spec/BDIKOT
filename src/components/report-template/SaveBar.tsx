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
      <button type="button" className="sh-btn" onClick={onTogglePreview}>{previewOn ? '✏️ עריכה' : '👁️ תצוגה מקדימה'}</button>
      {previewOn ? <button type="button" className="sh-btn" onClick={onPrint}>🖨️ הדפסה / PDF</button> : null}
      <button type="button" className="sh-btn sh-btn--primary" disabled={!canSave || saving} onClick={onSave}>{saving ? 'שומר…' : '💾 שמור'}</button>
    </footer>
  );
}
