import { describe, expect, it } from 'vitest';
import {
  COMBINED_DRAFTS_FOLDER, PICKER_ORDER, REPORT_CATEGORIES, REPORT_TYPE_CODES, REPORT_TYPES, draftsFolderDisplayName,
  draftsFolderKey, dynamicReportTitle, reportTypeDisplayName, reportTypeFromHebrewName, typesInCategory,
} from '@/core/reportTypes';
import { REPORT_SERVICES } from '@/services/reports';

// צילום של REPORT_TYPE_CODE_TO_DISPLAY_NAME באפליקציה הקיימת (v2.2.552). שינוי כאן = שבירת תאימות.
const LEGACY_CODE_TO_NAME: Record<string, string> = {
  SOIL: 'בדיקת התנגדות סגולית של הקרקע',
  GROUNDING: 'בדיקת התנגדות אלקטרודת הארקה למסה הכללית של האדמה',
  DC_CABLE: 'בדיקת בידוד וקוטביות כבלי וגידי DC',
  EV_DC: 'בדיקת עמדת טעינה DC',
  GENERAL: 'דוח כללי לבדיקת מתקן חשמל',
  MEDICAL: 'דוח בדיקה למתקן רפואי — קבוצת שימוש 2',
  LIGHTNING: 'דוח בדיקת מערכת הגנה מפני ברקים',
  TOUCH_VOLTAGE: 'דוח בדיקת מתח מגע',
  STRING_POLARITY: 'בדיקת קוטביות סטרינגים ולוחות DCCB',
  PV_INSPECTION: 'טופס בדיקה של מתקן פוטו-וולטאי',
  FIRE_FORM3: 'טופס 3 - אישור תקינות מערכת חשמל ותאורת חירום',
  TRANSFORMER_WINDING: 'דוח בדיקת התנגדות סלילים בשטח',
  HV_CABLE: 'דוח בדיקת כבל מתח גבוה',
  FLEXIBLE: 'דוח גמיש',
  MAIN_PANEL: 'דוח בדיקת לוח חשמל ראשי',
  TRANSFORMER_INSPECTION: 'דוח בדיקת שנאי מתח גבוה',
  GENERATOR: 'דוח בדיקת גנרטור',
  EVCS: 'בדיקת עמדת טעינה',
  SMA: 'טיפול בממירי SMA',
};

describe('19 סוגי הדוחות', () => {
  it('בדיוק 19 קודים, זהים לאפליקציה הקיימת', () => {
    expect(REPORT_TYPE_CODES).toHaveLength(19);
    expect([...REPORT_TYPE_CODES].sort()).toEqual(Object.keys(LEGACY_CODE_TO_NAME).sort());
  });
  it('שמות התצוגה זהים מילה במילה', () => {
    for (const [code, name] of Object.entries(LEGACY_CODE_TO_NAME)) expect(REPORT_TYPES[code as keyof typeof REPORT_TYPES].nameHe).toBe(name);
  });
  it('שירות קיים לכל סוג, עם הקוד הנכון', () => {
    for (const code of REPORT_TYPE_CODES) expect(REPORT_SERVICES[code].code).toBe(code);
  });
  it('הבורר: 18 סוגים בסדר FORM_TYPE_OPTIONS (EV_DC לא מוצג)', () => {
    expect(PICKER_ORDER).toHaveLength(18);
    expect(PICKER_ORDER).not.toContain('EV_DC');
    expect(PICKER_ORDER[0]).toBe('SMA');
    expect(PICKER_ORDER.at(-1)).toBe('FIRE_FORM3');
  });
  it('שם עברי → קוד, ולא מוכר → SMA (כמו getReportType)', () => {
    expect(reportTypeFromHebrewName('דוח בדיקת שנאי מתח גבוה')).toBe('TRANSFORMER_INSPECTION');
    expect(reportTypeFromHebrewName('משהו אחר')).toBe('SMA');
    expect(reportTypeFromHebrewName(undefined)).toBe('SMA');
    expect(reportTypeDisplayName('XYZ')).toBe('XYZ');
  });
  it('תיקיות טיוטות: MAIN_PANEL ו-TRANSFORMER_INSPECTION משותפות, משולב נפרד', () => {
    expect(draftsFolderKey('MAIN_PANEL')).toBe('בדיקות מתח גבוה');
    expect(draftsFolderKey('TRANSFORMER_INSPECTION')).toBe('בדיקות מתח גבוה');
    expect(draftsFolderKey('SOIL')).toBe('SOIL');
    expect(draftsFolderKey('SOIL', 2)).toBe(COMBINED_DRAFTS_FOLDER);
    expect(draftsFolderKey('nope')).toBe('UNKNOWN');
    expect(draftsFolderDisplayName('SOIL')).toBe('בדיקת התנגדות סגולית של הקרקע');
    expect(draftsFolderDisplayName('בדיקות מתח גבוה')).toBe('בדיקות מתח גבוה');
  });
  it('קטגוריות: "בדיקות מתח גבוה" כוללת לוח, כבל ושנאי', () => {
    expect(REPORT_CATEGORIES).toHaveLength(10);
    expect(typesInCategory('בדיקות מתח גבוה')).toEqual(['HV_CABLE', 'MAIN_PANEL', 'TRANSFORMER_INSPECTION']);
  });
  it('כותרת SMA דינמית לפי יצרן', () => {
    expect(dynamicReportTitle('SMA', 'Huawei')).toBe('טיפול בממירי Huawei');
    expect(dynamicReportTitle('SMA')).toBe('טיפול בממירי SMA');
  });
});
