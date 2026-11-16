/**
 * components/shared-sections/ApprovalEditor.tsx — "אישור חשמול" (state.approvalStatus).
 */
import type { ReportData } from '@/core/reportModel';
import { Card, ChoiceChips, type Choice } from '@/components/report-template';
import { APPROVAL_OPTIONS, needsRepairCommitment, readApproval } from '@/services/shared/approval';

type Mutate = (fn: (draft: ReportData) => void) => void;
const CHOICES: readonly Choice[] = [
  { value: APPROVAL_OPTIONS[0], label: APPROVAL_OPTIONS[0], tone: 'ok' },
  { value: APPROVAL_OPTIONS[1], label: APPROVAL_OPTIONS[1], tone: 'na' },
  { value: APPROVAL_OPTIONS[2], label: APPROVAL_OPTIONS[2], tone: 'bad' },
];

export function ApprovalEditor({ data, mutate }: { data: ReportData; mutate: Mutate }) {
  const v = readApproval(data);
  return (
    <Card title="אישור חשמול" icon="🔌">
      <p className="sh-dim">מסקנת הבדיקה. בלי בחירה — לא מודפס. לחיצה שנייה מבטלת.</p>
      <ChoiceChips ariaLabel="אישור חשמול" value={v} choices={CHOICES} onChange={(x) => mutate((d) => { d.approvalStatus = x; })} />
      {needsRepairCommitment(v) ? <p className="sh-dim">יודפס גם בלוק "אישור תיקון הליקויים" עם שורות לחתימת החשמלאי.</p> : null}
    </Card>
  );
}
