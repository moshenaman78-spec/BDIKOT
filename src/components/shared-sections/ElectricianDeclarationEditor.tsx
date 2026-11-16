/**
 * components/shared-sections/ElectricianDeclarationEditor.tsx — הצהרת החשמלאי המבצע (מודפסת בעמוד השער).
 */
import type { ReportData } from '@/core/reportModel';
import { BigCheckbox, ComboField, Field, Grid2, TextAreaField } from '@/components/report-template';
import { ELECTRICIAN_DECLARATION, LICENSE_TYPES, readElectricianDeclaration, writeElectricianField } from '@/services/shared/electricianDeclaration';

type Mutate = (fn: (draft: ReportData) => void) => void;

export function ElectricianDeclarationEditor({ data, mutate, hiddenGlobally }: { data: ReportData; mutate: Mutate; hiddenGlobally: boolean }) {
  if (hiddenGlobally) return <p className="sh-skeleton-note">הצהרת החשמלאי המבצע מבוטלת בכל הדוחות (הגדרות חברה ← הצהרת החשמלאי המבצע).</p>;
  const d = readElectricianDeclaration(data);
  return (
    <div>
      <BigCheckbox label="הצג הצהרת החשמלאי המבצע בדוח (בעמוד השער)" checked={d.enabled} onChange={(v) => mutate((x) => writeElectricianField(x, 'showElectricianDeclaration', v))} />
      {d.enabled ? (
        <>
          <TextAreaField label="ערוך את תוכן ההצהרה (אופציונלי)" placeholder={ELECTRICIAN_DECLARATION} value={d.text} rows={3}
            onChange={(v) => mutate((x) => writeElectricianField(x, 'electricianDeclarationText', v))} />
          <p className="sh-dim">פרטי החשמלאי שביצע את העבודה בפועל — לא פרטי הבודק. שדה ריק יודפס כקו למילוי ידני. החתימה — ידנית.</p>
          <Grid2>
            <Field label="שם החשמלאי המבצע" value={d.name} onChange={(v) => mutate((x) => writeElectricianField(x, 'workingElectricianName', v))} />
            <Field label="מס' רישיון" inputMode="numeric" value={d.licenseNo} onChange={(v) => mutate((x) => writeElectricianField(x, 'workingElectricianLicenseNo', v))} />
          </Grid2>
          <ComboField label="סוג רישיון" value={d.licenseType} options={LICENSE_TYPES} onChange={(v) => mutate((x) => writeElectricianField(x, 'workingElectricianLicenseType', v))} />
        </>
      ) : null}
    </div>
  );
}
