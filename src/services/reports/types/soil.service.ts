/**
 * SOIL — בדיקת התנגדות סגולית של הקרקע (קידומת GEO).
 * מבנה: state.soilTest.resistivityData באפליקציה הישנה — לכל נקודה ערכים בשני כיוונים
 * (צפון-דרום / מזרח-מערב) לכל מרחק a ב-RESISTIVITY_DISTANCES.
 * TODO(SOIL): להעביר את חישובי/גרפי renderSoilTestCards (שורה ~20517) ואת טבלת התקנים.
 */
import { defineReportService, mergeDefaults } from '../ReportTypeService';

export const RESISTIVITY_DISTANCES = [1.5, 2.0, 3.0, 4.5, 6.0, 9.0, 13.5, 18] as const;

export interface ResistivityLocation {
  name: string;
  northSouth: string[];
  eastWest: string[];
}
export interface SoilData {
  resistivityData: ResistivityLocation[];
  instrument: string;
  weather: string;
}

export const makeResistivityLocation = (name = ''): ResistivityLocation => ({
  name, northSouth: RESISTIVITY_DISTANCES.map(() => ''), eastWest: RESISTIVITY_DISTANCES.map(() => ''),
});

const createEmpty = (): SoilData => ({ resistivityData: [makeResistivityLocation('1')], instrument: '', weather: '' });

export const soilService = defineReportService<SoilData>('SOIL', {
  createEmpty,
  normalize: (raw) => {
    const d = mergeDefaults(createEmpty(), raw);
    d.resistivityData = d.resistivityData.map((l) => ({
      name: l.name ?? '',
      northSouth: RESISTIVITY_DISTANCES.map((_, i) => l.northSouth?.[i] ?? ''),
      eastWest: RESISTIVITY_DISTANCES.map((_, i) => l.eastWest?.[i] ?? ''),
    }));
    return d;
  },
  validate: (d) => d.resistivityData.flatMap((l, i) =>
    [...l.northSouth, ...l.eastWest].every((v) => !v)
      ? [{ path: `resistivityData.${i}`, message: `נקודה ${l.name || i + 1}: אין מדידות`, severity: 'warning' as const }]
      : []),
  buildSections: (d) => [{
    id: 'soil-resistivity', zone: 'content', title: 'תוצאות מדידה', icon: '🌍',
    blocks: d.resistivityData.map((l, i) => ({
      kind: 'facility' as const, title: `נקודת מדידה ${l.name || i + 1}`,
      blocks: [{
        kind: 'table' as const, columns: ['מרחק a [m]', 'צפון-דרום [Ω·m]', 'מזרח-מערב [Ω·m]'],
        rows: RESISTIVITY_DISTANCES.map((a, j) => [String(a), l.northSouth[j], l.eastWest[j]]),
      }],
    })),
  }],
});
