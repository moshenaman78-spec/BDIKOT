/**
 * components/shared-sections/TestInstrumentsPicker.tsx — מכשירי בדיקה (meta.testInstrumentsSelected).
 * תיבות סימון גדולות; לכל מכשיר שנמצא בטבלת הציוד — דגם, מס' סידורי ותוקף כיול (עם התראה).
 */
import type { ReportData } from '@/core/reportModel';
import { BigCheckbox, Field } from '@/components/report-template';
import {
  TEST_INSTRUMENT_QUICK_OPTIONS, calibrationStatus, findMatchingEquipment, formatDateIL, readSelectedInstruments, type Equipment,
} from '@/services/shared/testInstruments';

type Mutate = (fn: (draft: ReportData) => void) => void;
const CAL_TEXT = { ok: '', warning: '⚠️ פג בקרוב', expired: '⛔ פג תוקף' } as const;

export function TestInstrumentsPicker({ data, mutate, equipment }: { data: ReportData; mutate: Mutate; equipment: Equipment[] | null }) {
  const selected = readSelectedInstruments(data);
  const toggle = (name: string, on: boolean) => mutate((d) => {
    const cur = readSelectedInstruments(d).filter((x) => x !== name);
    d.meta.testInstrumentsSelected = on ? [...cur, name] : cur;
  });
  return (
    <div>
      <div className="sh-subhead">מכשירי בדיקה (מופיעים בעמוד השער)</div>
      {equipment === null ? <p className="sh-dim">רשימת הציוד מהענן לא נטענה — מס' סידורי ותוקף כיול לא יוצגו.</p> : null}
      <div className="sh-grid2">
        {TEST_INSTRUMENT_QUICK_OPTIONS.map((name) => {
          const eq = equipment ? findMatchingEquipment(name, equipment) : null;
          const st = eq ? calibrationStatus(eq.calibrationDate) : null;
          return (
            <div key={name}>
              <BigCheckbox label={name} checked={selected.includes(name)} onChange={(v) => toggle(name, v)} />
              {eq && selected.includes(name) ? (
                <div className={`sh-dim ${st === 'expired' ? 'sh-text-bad' : ''}`} style={{ marginInlineStart: 40 }}>
                  {eq.serialNo ? `מס' ${eq.serialNo} · ` : ''}כיול עד {formatDateIL(eq.calibrationDate) || '—'} {st ? CAL_TEXT[st] : ''}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {selected.includes('אחר') ? (
        <Field label="מכשיר אחר" value={String(data.meta.testInstrumentsOther ?? '')} onChange={(v) => mutate((d) => { d.meta.testInstrumentsOther = v; })} />
      ) : null}
    </div>
  );
}
