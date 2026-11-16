# MIGRATION — מעבר מהאפליקציה הקיימת (v2.2.552) לאפליקציה החדשה (React + TypeScript)

## עיקרון
- האפליקציה הקיימת ממשיכה לרוץ ב-`/` בלי שינוי. החדשה מוגשת ב-`/app/` (`vite.config.ts` → `base: '/app/'`, build ל-`dist/app`).
- שתיהן עובדות על **אותו** Supabase ואותן טבלאות. אין שינוי סכימה.
- דוח שנשמר באחת חייב להיפתח בשנייה: `report_type` נשאר אותו קוד, `report_data` נשמר כולו (שדות לא מוכרים נשמרים כמו שהם — `mergeDefaults`).

## מבנה התיקיות
| תיקייה | תפקיד |
|---|---|
| `src/core/` | `reportTypes.ts` — 19 סוגי הדוחות (מקור אמת יחיד). `reportModel.ts` — מודל נתונים ומודל מסמך, סדר הסעיפים. |
| `src/services/` | `supabaseClient.ts`, `sync/saveRules.ts` (כללי שמירה טהורים), `sync/reportStore.ts` (ממשק + Supabase), `reportSyncService.ts`, `versionService.ts`, `reportNumber.ts`, `photoStorageService.ts`, `companySettingsService.ts`. |
| `src/services/reports/` | `ReportTypeService.ts` (חוזה + `buildReportDocument`), `registry.ts` (שירות לכל סוג), `types/*.service.ts` (19 קבצים). |
| `src/components/report-template/` | רכיבי UI של העיצוב החדש + `ReportDocumentView` (תצוגה = הדפסה/PDF). |
| `src/styles/` | `tokens.ts` (צבעים/גופנים במקום אחד), `theme.css`, `print.css`. |
| `src/features/` | מסכים. כרגע `report-preview`. בהמשך תיקייה לכל סוג דוח (`features/reports/<code>/`). |
| `tests/` | 62 בדיקות (vitest). |

## 19 הסוגים — מצב העברה
מקור: `REPORT_TYPE_CODE_TO_DISPLAY_NAME` ו-`getReportType()` ב-`js/app.js`. בדיקה `tests/reportTypes.test.ts` נכשלת אם הרשימה סוטה.

| קוד | שם | קידומת | שירות | מקור באפליקציה הישנה |
|---|---|---|---|---|
| SMA | טיפול בממירי SMA | לפי יצרן | שלד | render ברירת מחדל, makePanel |
| SOIL | בדיקת התנגדות סגולית של הקרקע | GEO | **מלא (נתונים)** | renderSoilTestCards |
| GROUNDING | בדיקת התנגדות אלקטרודת הארקה… | RPT | שלד | renderGroundingTestCards |
| DC_CABLE | בדיקת בידוד וקוטביות כבלי וגידי DC | RPT | שלד | renderDcCableTestCards |
| EVCS | בדיקת עמדת טעינה | RPT | שלד | renderEvcsReportCards |
| EV_DC | בדיקת עמדת טעינה DC | RPT | שלד | renderEvDcTestCards |
| GENERAL | דוח כללי לבדיקת מתקן חשמל | RPT | שלד | renderGeneralInspectionCards |
| MEDICAL | דוח בדיקה למתקן רפואי — קבוצת שימוש 2 | RPT | שלד | renderMedicalReportCards |
| LIGHTNING | דוח בדיקת מערכת הגנה מפני ברקים | RPT | שלד | renderLightningReportCards |
| TOUCH_VOLTAGE | דוח בדיקת מתח מגע | RPT | שלד | renderTouchVoltageReportCards |
| TRANSFORMER_WINDING | דוח בדיקת התנגדות סלילים בשטח | RPT | שלד | renderTransformerWindingReportCards |
| HV_CABLE | דוח בדיקת כבל מתח גבוה (VLF) | RPT | חלקי | renderHvCableReportCards |
| FLEXIBLE | דוח גמיש | RPT | שלד | renderFlexibleReportCards |
| MAIN_PANEL | דוח בדיקת לוח חשמל ראשי | HV | שלד | renderMainPanelReportCards |
| TRANSFORMER_INSPECTION | דוח בדיקת שנאי מתח גבוה | TR | **מלא** | renderTransformerInspectionReportCards |
| GENERATOR | דוח בדיקת גנרטור | RPT | שלד | renderGeneratorReportCards |
| STRING_POLARITY | בדיקת קוטביות סטרינגים ולוחות DCCB | PV | שלד | renderStringPolarityReportCards |
| PV_INSPECTION | טופס בדיקה של מתקן פוטו-וולטאי | PV | שלד | renderPvInspectionCards |
| FIRE_FORM3 | טופס 3 - אישור תקינות מערכת חשמל ותאורת חירום | F3 | **מלא** | makeFireForm3 |

"דוח משולב" אינו סוג נפרד: דוח עם `reportChapters` נשמר עם סוג הדוח הראשי ומוצג בתיקייה `📚 דוחות משולבים`.

## ⚠️ פער מבני שחייב החלטה לפני העברת סוג
באפליקציה הישנה הנתונים הייעודיים לסוג נמצאים **ברמה העליונה** של `report_data` (למשל `soilTest`, `fireForm3`, `panels`, `transformerInspection`...). במודל החדש הם תחת `report_data.typeData`.
**TODO:** לכל סוג — לכתוב `fromLegacy(report_data)` / `toLegacy(typeData)` ב-service, ולכתוב **גם** לשדה הישן בשמירה, כדי שהאפליקציה הישנה תמשיך לפתוח דוחות שנערכו בחדשה. לא לבצע מיגרציית נתונים בענן.

## כללי שמירה (נאכפים ב-`saveRules.ts`, נבדקים ב-`tests/`)
1. זהות ומספר דוח קבועים: UPDATE לאותו UUID; `report_number` לא נשלח ב-UPDATE.
2. אין יצירה שקטה: INSERT רק ל-`cloudInsertPending` (פעולת "דוח חדש" מפורשת); דוח אוטומטי ריק לא נוצר.
3. אין דריסה: `UPDATE ... WHERE updated_at = known`; 0 שורות → חלונית קונפליקט.
4. אין ארכוב אוטומטי (ארכוב רק דרך `archiveExplicit`).
5. חלונית קונפליקט: טען גרסת ענן / שמור כעותק (UUID ומספר חדשים) / השווה (לא כותב).
6. **שינוי מכוון:** שחזור גרסה עובר דרך UPDATE מותנה (בישן היה UPDATE לא מותנה).

## מה חסר כאן (נמצא ב-bdikot-react-foundation.zip, שלא נמצא בריפו)
- מסכי התחברות, רשימת טיוטות עם חיפוש, עריכת פרטים כלליים, חלונית הקונפליקט כרכיב React.
- ליבת הסנכרון המקורית + 35 בדיקות יחידה, תור offline.
**TODO:** להעלות את ה-zip לריפו, ולמזג: ליבת הסנכרון שם מול `services/sync/` כאן (לשמור אחת), המסכים תחת `src/features/`.

## צעדים הבאים מוצעים
1. העלאת ה-foundation ומיזוג.
2. `fromLegacy/toLegacy` לסוג אחד (מומלץ TRANSFORMER_INSPECTION — השירות כבר מלא) ובדיקה דו-כיוונית מול דוח אמיתי.
3. עורך לסוג זה תחת `features/reports/TRANSFORMER_INSPECTION/` עם רכיבי `report-template/ui.tsx`.
4. Vercel: rewrite של `/app/*` ל-`dist/app/index.html`; האפליקציה הישנה ב-`/` ללא שינוי.
5. להמשיך סוג אחר סוג לפי שימוש.
