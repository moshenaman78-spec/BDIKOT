/**
 * סימולציה נאמנה של איך האפליקציה הישנה (v2.2.552) טוענת דוח שנאי — להוכחת תאימות דו-כיוונית.
 * הועתק מ-js/app.js: deepMergeGeneric (שורה ~12034), mergeDefaults (~11752, החלק של
 * transformerInspectionReport), ורשת הביטחון לשנאים (~8981).
 */
import { TI_CHECKLIST, TI_INSULATION_TESTS } from '@/services/reports/types/transformerInspection.service';

type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

export function deepMergeGeneric(base: Json, loaded: Json): Json {
  if (loaded == null) return JSON.parse(JSON.stringify(base));
  if (Array.isArray(base)) return Array.isArray(loaded) ? loaded : JSON.parse(JSON.stringify(base));
  if (typeof base === 'object' && base !== null) {
    const out: Json = {};
    Object.keys(base).forEach((key) => { out[key] = deepMergeGeneric(base[key], loaded ? loaded[key] : undefined); });
    return out;
  }
  return loaded !== undefined && loaded !== null ? loaded : base;
}

let panelSeq = 0;
export function legacyMakeTransformerInspectionItem(num: number): Json {
  return {
    id: `panel_legacy${panelSeq++}`, num,
    serialNo: '', model: '', manufacturer: '', powerKVA: '', primaryVoltageKV: '', secondaryVoltageV: '',
    connectionGroup: '', yearOfManufacture: '', transformerType: '', shortCircuitVoltagePercent: '',
    groundingMethod: { parallelConductors: '', crossSection: '', conductorType: '' },
    groundingProtection: { parallelConductors: '', crossSection: '', conductorType: '' },
    checklistEnabled: true,
    checklist: TI_CHECKLIST.map(() => ({ status: '', notes: '' })),
    insulationEnabled: true,
    insulationTests: TI_INSULATION_TESTS.map((t) => ({ key: t.key, enabled: false, status: '', value: '' })),
    sectionNotes: '',
  };
}

/** החלק הרלוונטי של newState() בישן. */
export function legacyNewState(): Json {
  return {
    meta: { siteName: '', address: '', client: '', clientAddress: '', date: '', issueDate: '', description: '', attentionTo: '', project: '', reportNumber: '' },
    settings: { formTypeName: '' },
    notes: [''],
    customDeclaration: '',
    protectionRelays: [],
    transformerInspectionReport: {
      testInstrumentsText: '', accompaniedBy: '',
      transformers: [legacyMakeTransformerInspectionItem(1)],
      summaryItems: [],
      conclusion: { status: '', freeText: '' },
    },
  };
}

/** mergeDefaults + רשת הביטחון — מה שהישנה מחזיקה בזיכרון אחרי טעינת report_data. */
export function legacyLoad(loaded: Json): Json {
  const base = legacyNewState();
  const merged: Json = Object.assign({}, base, loaded);
  merged.meta = Object.assign({}, base.meta, loaded.meta || {});
  merged.settings = Object.assign({}, base.settings, loaded.settings || {});
  merged.customDeclaration = loaded.customDeclaration !== undefined ? loaded.customDeclaration : '';
  merged.transformerInspectionReport = deepMergeGeneric(
    { ...base.transformerInspectionReport, transformers: [] },
    loaded.transformerInspectionReport ? { ...loaded.transformerInspectionReport, transformers: [] } : undefined,
  );
  merged.transformerInspectionReport.transformers =
    loaded.transformerInspectionReport && Array.isArray(loaded.transformerInspectionReport.transformers)
      ? loaded.transformerInspectionReport.transformers : base.transformerInspectionReport.transformers;
  merged.transformerInspectionReport.transformers = merged.transformerInspectionReport.transformers.map((tr: Json, i: number) =>
    deepMergeGeneric(legacyMakeTransformerInspectionItem(tr.num || i + 1), tr));
  return merged;
}

/** בדיקת "לא יקרוס" — אותן גישות שהרינדור הישן עושה (tr.checklist[ci].status וכו'). */
export function legacyRenderSmoke(state: Json): void {
  const ti = state.transformerInspectionReport;
  ti.transformers.forEach((tr: Json) => {
    TI_CHECKLIST.forEach((_, ci) => { void tr.checklist[ci].status; void tr.checklist[ci].notes.length; });
    TI_INSULATION_TESTS.forEach((_, ii) => { void tr.insulationTests[ii].enabled; void String(tr.insulationTests[ii].value); });
    void tr.groundingMethod.parallelConductors;
  });
  (ti.summaryItems || []).forEach((s: Json) => { void s.number; void String(s.text).trim(); });
  void ti.conclusion.status;
  state.notes.forEach((n: Json) => { if (typeof n !== 'string') throw new Error('notes חייב להיות מערך מחרוזות'); });
}

/* ---------------- לוח חשמל ראשי — mergeDefaults (שורה ~11808 בישן) ---------------- */

const SWITCHGEAR_LEN = 35;
export function legacyMainPanelBase(): Json {
  const checklist: Json = {}; for (let i = 0; i < SWITCHGEAR_LEN; i++) checklist[i] = '';
  return {
    protectionMethod: '', electricalApproval: '', accompaniedBy: '', testInstruments: [],
    facilities: [{ id: 'panel_base', name: '' }], summaryItems: [],
    mainSwitchgear: {
      notes: '', cabinetDetails: '', checklist, panelRows: [],
      assemblyDetails: {
        name: '', manufacturer: '', model: '', serialNo: '', yearOfManufacture: '', ratedVoltage: '', ratedVoltageUnit: 'kV', ratedCurrent: '', ratedCurrentUnit: 'A',
        breakingCapacity: '', breakingCapacityUnit: 'kA', numberOfCells: '', insulationType: '', standard: '', installLocation: '', notes: '',
        measurementCT: { type: '', model: '', va: '', alf: '', cls: '', ratio: '' },
        protectionCT: { manufacturer: '', model: '', serialNo: '', secondaryCurrent: '', busbarWithstand: '' },
        summaryCT: { type: '', model: '', va: '', alf: '', ratio: '' },
      },
    },
    hvCells: [],
    insulationTests: { rows: [0, 1, 2].map(() => ({ r15: '', r60: '', dar: '', note: '', manualClassification: '', unit: 'MΩ', temp: '' })), testMethod: 'dar' },
  };
}

export function legacyLoadMainPanel(loaded: Json): Json {
  const mpBase = legacyMainPanelBase();
  const mpSaved = loaded.mainPanelReport || {};
  const state: Json = Object.assign({}, { notes: [''], itemNotes: {}, approvalStatus: '' }, loaded);
  state.mainPanelReport = {
    protectionMethod: mpSaved.protectionMethod || mpBase.protectionMethod,
    electricalApproval: mpSaved.electricalApproval || mpBase.electricalApproval,
    accompaniedBy: mpSaved.accompaniedBy || mpBase.accompaniedBy,
    testInstruments: Array.isArray(mpSaved.testInstruments) ? mpSaved.testInstruments : mpBase.testInstruments,
    facilities: Array.isArray(mpSaved.facilities) ? mpSaved.facilities : mpBase.facilities,
    summaryItems: Array.isArray(mpSaved.summaryItems) ? mpSaved.summaryItems : mpBase.summaryItems,
    mainSwitchgear: deepMergeGeneric(mpBase.mainSwitchgear, mpSaved.mainSwitchgear),
    hvCells: Array.isArray(mpSaved.hvCells) ? mpSaved.hvCells : mpBase.hvCells,
    insulationTests: deepMergeGeneric(mpBase.insulationTests, mpSaved.insulationTests),
  };
  return state;
}

/** אותן גישות שהרינדור/הדפסה הישנים עושים — לא יקרוס. */
export function legacyMainPanelRenderSmoke(state: Json): void {
  const mp = state.mainPanelReport;
  for (let i = 0; i < SWITCHGEAR_LEN; i++) void String(mp.mainSwitchgear.checklist[i]);
  void mp.mainSwitchgear.assemblyDetails.measurementCT.type;
  mp.hvCells.forEach((c: Json) => { void (c.cellType || c.cellName); void String(c.ratedVoltageUnit); });
  [0, 1, 2].forEach((i) => { void mp.insulationTests.rows[i].r15; void mp.insulationTests.rows[i].unit; });
  mp.summaryItems.forEach((s: Json) => { void s.number; void String(s.text).trim(); });
  if (typeof state.itemNotes !== 'object') throw new Error('itemNotes חייב להיות אובייקט');
}
