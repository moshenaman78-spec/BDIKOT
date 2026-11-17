/** report_data של דוח לוח חשמל ראשי כפי שהישנה שומרת (מקוצר). כולל לוח ישן (facilities) עם ליקוי. */
export function legacyMainPanelReportData() {
  const checklist: Record<string, string> = {};
  for (let i = 0; i < 35; i++) checklist[String(i)] = i < 10 ? 'ok' : '';
  checklist['3'] = 'bad';
  return {
    meta: { siteName: 'מבנה תעשייה', address: 'אשדוד', client: 'מפעל בע"מ', date: '2026-11-01', reportNumber: 'HV-1100-11-2026', description: 'בדיקה שנתית' },
    settings: { formTypeName: 'דוח בדיקת לוח חשמל ראשי', cloudReportId: 'mp-1', savedByDevice: 'dev_old', cloudInsertPending: false, logo: 'data:image/png;base64,AAAA' },
    notes: [''],
    itemNotes: { 'mainPanelReport.mainSwitchgear.checklist|3': 'חסר חיזוק ברגי בסיס', 'panels.p1.checklist|0': 'שייך לדוח אחר' },
    itemPhotos: { 'mainPanelReport.mainSwitchgear.checklist|3': [{ id: 'ip1', cloudPath: 'mp-1/x.jpg' }] },
    approvalStatus: '',
    protectionRelays: [],
    defectRepairElectricianName: '',
    mainPanelReport: {
      protectionMethod: 'TNCS', electricalApproval: '', accompaniedBy: 'אב הבית', testInstruments: ['גשר'],
      facilities: [{ id: 'panel_f1', name: 'לוח ראשי', hvVisualChecks: [{ id: 'hv-dgpt', name: 'בדיקת DGPT', status: 'V', notes: '' }], testItems: [{ id: 't1', name: 'רציפות', status: 'V' }], powerSupplies: [{ id: 'ps1' }] }],
      summaryItems: [{ number: 1, text: 'יש לחזק ברגי בסיס' }],
      mainSwitchgear: {
        notes: '', cabinetDetails: '8 תאים RM6', checklist, panelRows: [{ panelName: 'שורה ישנה' }],
        assemblyDetails: {
          name: 'מסדר ראשי', manufacturer: 'Schneider Electric', model: 'RM6', serialNo: 'SN-9', yearOfManufacture: '2012',
          ratedVoltage: '22', ratedVoltageUnit: 'kV', ratedCurrent: '630', ratedCurrentUnit: 'A', breakingCapacity: '16', breakingCapacityUnit: 'kA',
          numberOfCells: '8', insulationType: 'SF6 (GIS)', standard: 'IEC 62271', installLocation: 'חדר חשמל', notes: '',
          measurementCT: { type: 'CT', model: 'M1', va: '15', alf: '', cls: '0.5', ratio: '400/5' },
          protectionCT: { manufacturer: '', model: '', serialNo: '', secondaryCurrent: '', busbarWithstand: '' },
          // summaryCT חסר — דוח ישן
        },
      },
      hvCells: [
        { cellType: 'תא כניסה', cellName: 'כניסה 1', cellNumber: '1', manufacturer: 'Schneider Electric', ratedVoltage: '22', ratedVoltageUnit: 'kV' }, // שדות חסרים
        { cellType: '', cellName: '', manufacturer: '', serialNo: '' }, // תא ריק — לא מודפס
      ],
      insulationTests: { rows: [{ r15: '1000', r60: '1500', unit: 'MΩ', note: '', manualClassification: '', dar: '', temp: '' }], testMethod: 'dar' }, // שורות חסרות
    },
  };
}
