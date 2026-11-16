/**
 * styles/tokens.ts — פלטת הצבעים והגופנים במקום אחד.
 * בסיס: redesign-light.css באפליקציה הקיימת (v2.2.552) + הצבעים של העיצוב החדש.
 * theme.css מייצר מזה משתני CSS (--sh-*) — אין לכתוב צבע hex ישירות ברכיב.
 */
export const colors = {
  // מותג
  navy: '#0F2E4D',        // כותרת עליונה, כרטיס מתקן כהה
  brandBlue: '#1760A8',   // כותרת כחולה, קישורים, פוקוס
  sky: '#9EC3E6',         // מסגרת תכלת לכרטיסים
  skySoft: '#E8F1FA',     // רקע כותרת כרטיס / לשונית פעילה
  bolt: '#F6B34A',        // ⚡ בלוגו

  // כפתורים עגולים
  add: '#F28C28',         // כתום — הוספה
  duplicate: '#2BA3D9',   // תכלת — שכפול
  remove: '#D64545',      // אדום — מחיקה

  // משטחים וטקסט
  bg: '#EEF2F6',
  panel: '#FFFFFF',
  panel2: '#F4F7FA',
  line: '#D5DFEA',
  inputBorder: '#C3D1DF',
  text: '#16212E',
  textDim: '#4B5B6B',

  // סטטוס
  ok: '#1E7B45', okBg: '#DCF1E4',
  bad: '#B42318', badBg: '#FDECEA',
  na: '#475569', naBg: '#E3E8EF',
  pending: '#B7791F', pendingBg: '#FFFBEB',
} as const;

export const fonts = {
  ui: "'Heebo', 'Assistant', system-ui, sans-serif",
  print: "'Assistant', 'Heebo', Arial, sans-serif",
} as const;

export const radius = { card: '14px', input: '10px', round: '999px' } as const;
export const sizes = { touch: '48px', checkbox: '28px', roundBtn: '44px' } as const;

export type ColorToken = keyof typeof colors;

const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

/** משמש ב-main.tsx להזרקת המשתנים, וגם בבדיקות. */
export function cssVariables(): string {
  const lines = [
    ...Object.entries(colors).map(([k, v]) => `--sh-${kebab(k)}:${v};`),
    ...Object.entries(fonts).map(([k, v]) => `--sh-font-${k}:${v};`),
    ...Object.entries(radius).map(([k, v]) => `--sh-radius-${k}:${v};`),
    ...Object.entries(sizes).map(([k, v]) => `--sh-size-${k}:${v};`),
  ];
  return `:root{${lines.join('')}}`;
}
