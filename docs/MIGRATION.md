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
| `tests/` | 168 בדיקות (vitest), כולל תאימות מול הישנה. |

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
| MAIN_PANEL | דוח בדיקת לוח חשמל ראשי | HV | **הועבר עד הסוף** (שירות + עורך + PDF + תאימות) | renderMainPanelReportCards |
| TRANSFORMER_INSPECTION | דוח בדיקת שנאי מתח גבוה | TR | **הועבר עד הסוף** (שירות + עורך + PDF + תאימות) | renderTransformerInspectionReportCards |
| GENERATOR | דוח בדיקת גנרטור | RPT | שלד | renderGeneratorReportCards |
| STRING_POLARITY | בדיקת קוטביות סטרינגים ולוחות DCCB | PV | שלד | renderStringPolarityReportCards |
| PV_INSPECTION | טופס בדיקה של מתקן פוטו-וולטאי | PV | שלד | renderPvInspectionCards |
| FIRE_FORM3 | טופס 3 - אישור תקינות מערכת חשמל ותאורת חירום | F3 | **מלא** | makeFireForm3 |

"דוח משולב" אינו סוג נפרד: דוח עם `reportChapters` נשמר עם סוג הדוח הראשי ומוצג בתיקייה `📚 דוחות משולבים`.

## כלל תאימות: כותבים למפתח הישן (הוחלט והוטמע בשנאי)
נבדק מול `mergeDefaults` / `deepMergeGeneric` בישן:
- הישנה לא קוראת מפתחות שהיא לא מכירה — לכן נתונים ב-`typeData` לא ייראו שם.
- בתוך אובייקט של סוג דוח (למשל `transformerInspectionReport`, וכל שנאי בו) הישנה משאירה רק מפתחות שקיימים בברירת המחדל שלה. שדה חדש שם יימחק בשמירה הבאה מהישנה. ברמה העליונה היא שומרת מפתחות לא מוכרים (`Object.assign`).
- **תוקן באג מהגרסה הקודמת של הבסיס:** `notes` הוגדר כמערך אובייקטים, אבל בישן הוא מערך מחרוזות. דוח שהיה נשמר מהחדשה היה מציג הערות שבורות בישנה. עכשיו `notes: string[]`, ו-`summary`/`typeData` לא נוספים לדוח.

לכן כל שירות שהועבר מגדיר `legacyKey` וקורא/כותב רק אליו (`readTypeData`/`writeTypeData`). אין המרה ואין מיגרציית נתונים. שדה חדש באמת (שלא קיים בישן) — רק אחרי שהוא נוסף גם ל-`newState()`/`make*` בישן.

## שנאי מתח גבוה — מה הועבר
| חלק | קובץ |
|---|---|
| מבנה נתונים, קבועים, נרמול, שכפול/מחיקה, ליקויים, בדיקות לפני הפקה, פלט מסמך | `src/services/reports/types/transformerInspection.service.ts` |
| עורך (01 פרטי המתקן, 02 שנאים, 03 ממצאים, 04 מסקנה, הערות, הערות בודק) | `src/features/reports/TRANSFORMER_INSPECTION/TransformerInspectionEditor.tsx` |
| מסך: טיוטות שנאי בענן + חיפוש, דוח חדש מפורש, הדגמה מקומית, תצוגה/הדפסה, שמירה, קונפליקט | `.../TransformerInspectionScreen.tsx` |
| עורך כללי: שמירה אוטומטית (5 שנ׳), גיבוי מקומי, קונפליקט | `src/features/report-editor/useReportEditor.ts`, `useCloud.ts` |
| תאימות: סימולציה של טעינה בישן + נתונים במבנה אמיתי | `tests/legacyApp.ts`, `tests/fixtures/legacyTransformerReport.ts`, `tests/transformerInspection.test.ts` |

הבדלים מכוונים מול הישן (הנתונים עצמם זהים):
- ממצאים מסכמים ממוספרים רציף (בישן מחיקה השאירה חורים, למשל 1, 3).
- כפתור "העתק ליקויים שסומנו לא תקין" לממצאים, וכפתור "סמן תקין לכל מה שטרם נבדק".
- כפתור הוספת שנאי (כתום), בנוסף לשכפול. בישן היה רק שכפול.
- בדיקות לפני הפקה: מסקנה חסרה (שגיאה), "תקין" עם ליקויים, "לא תקין" בלי הערה, ערך בידוד לא מספרי (אזהרות).
- checklist קצר מ-22 בדוח ישן מרופד (בישן היה קורס).

## ממסרי הגנה — מודול משותף (הועבר)
משמש SMA, שנאי מתח גבוה ולוח ראשי (`RELAY_REPORT_TYPES`). נתונים ב-`report_data.protectionRelays`, אותו מבנה ואותם מפתחות כמו בישן. הגדרות נשמרות בקידוד של הישנה: `I>` נשמר כ-`Igt`, `I>>` כ-`Igtgt`.
| חלק | קובץ |
|---|---|
| ספריית דגמים (ABB REJ603, Kries IKI-30, אחר), מבנה, נרמול, הוספה/שכפול/מחיקה, מתגי DIP, פלט, ליקויים, בדיקות | `src/services/shared/protectionRelays.ts` |
| כרטיס עריכה (כרטיס כהה לכל ממסר, מתגי DIP בלחיצה, מתג 1 משמאל) | `src/components/protection-relays/ProtectionRelaysEditor.tsx` |
| שילוב: סעיף "ממסרי הגנה" נוסף אוטומטית למסמך של 3 הסוגים, הבדיקות לפני הפקה כוללות את הממסרים, ליקויים נכנסים לטבלת הליקויים או לכפתור "העתק ליקויים" בשנאי | `ReportTypeService.ts`, `registry.ts`, `TransformerInspectionEditor.tsx` |

הבדלים מכוונים מול הישן:
- **מיקום בדוח:** בישן הממסרים מודפסים אחרי המסקנה. כאן הם סעיף תוכן לפני "ממצאים מסכמים"/"מסקנה", לפי הכלל "כל התוכן לפני הסיכום". לכן בשנאי עם ממסרים המספור הוא: 01 פרטי המתקן, 02 שנאים, 03 ממסרי הגנה, 04 ממצאים, 05 מסקנה.
- **שכפול ממסר מקבל id חדש.** בישן השכפול הגנרי העתיק גם את ה-id.
- **בדיקות לפני הפקה:** ממסר ריק (לא יודפס), חסר מיקום, "לא תקין" בלי הערה, דגם לא מוכר.
- **דגם חדש:** יש להוסיף אותו ל-`RELAY_LIBRARY` גם כאן וגם בישן. אחרת הישנה תציג אותו כ"אחר".

ב-SMA ובלוח הראשי (שעדיין שלדים) הממסרים כבר מודפסים בתצוגה המקדימה של החדשה. העריכה של הסוגים האלה עדיין בישנה, ו-`ProtectionRelaysEditor` מוכן לשילוב בעורכים שלהם כשיועברו.

## דוח שנאי — מוכן לשטח (עמוד שער, תמונות, הצהרות)
| חלק | קובץ | מקור בישן |
|---|---|---|
| הגדרות חברה — **קריאה בלבד**, בפורמט הישן (`settings_json` + `logo_path`/`signature_path`/`stamp_path`), עם נפילה להגדרות שבדוח | `services/companySettingsService.ts` | applyCloudCompanySettings |
| עמוד שער: לוגו, כותרת, מספר דוח, טבלת פרטים באותו סדר, מכשירי בדיקה עם דגם/מס' סידורי/תוקף כיול, הצהרת חשמלאי, חתימת הבודק | `ReportTypeService.buildCover`, `ReportDocumentView.CoverPageView` | buildCoverPage |
| פוטר בכל עמוד: לוגו תחתון, פרטי החברה, חתימה | `ReportDocumentView`, `print.css` | buildFooterHtml |
| מכשירי בדיקה + תוקף כיול (טבלת `equipment`, קריאה בלבד) | `services/shared/testInstruments.ts`, `components/shared-sections/TestInstrumentsPicker.tsx` | instrumentDetailsText, getCalibrationStatus |
| הצהרת חשמלאי מבצע | `services/shared/electricianDeclaration.ts`, `ElectricianDeclarationEditor.tsx` | getElectricianDeclarationData, buildElectricianDeclarationBlock |
| אישור חשמול + אישור תיקון ליקויים | `services/shared/approval.ts`, `ApprovalEditor.tsx` | approvalStatus, APPROVAL_OPTIONS |
| תיעוד תמונות: צילום/גלריה, דחיסה 1400px, כותרת, הערות 1.1/1.2, סדר, העלאה ל-`report-files` (גם ממתינות אחרי יצירה) | `services/shared/photos.ts`, `services/photoUpload.ts`, `PhotosEditor.tsx` | generalPhotos, makePhotoEntry, uploadFileToCloudStorage, processPendingPhotoUploads |
| צילום רישיון בודק כנספח (אם מסומן בהגדרות) | `licenseSection` | buildInspectorLicenseBlock |

נשמר באותם מפתחות כמו בישן: `generalPhotos`, `approvalStatus`, `showElectricianDeclaration`, `electricianDeclarationText`, `workingElectrician*`, `meta.testInstrumentsSelected`, `meta.testInstrumentsOther`, `meta.issueDate`.

מה כותבים לענן ומה לא: האפליקציה החדשה כותבת רק לטבלה `reports` (השמירה המותנית, כמו קודם) ולדלי `report-files` (תמונות של הדוח, `upsert: false`). את `company_settings` ואת `equipment` היא רק קוראת. העריכה של שתיהן נשארת באפליקציה הישנה. **תוקן:** `companySettingsService` הקודם קרא עמודות שהישנה לא משתמשת בהן, וגם כלל פונקציית שמירה בפורמט אחר. הפונקציה הוסרה.

הבדלים מכוונים מול הישן:
- **חתימת החשמלאי:** בישן, בסוגים הגנריים, משבצת חתימת החשמלאי הציגה את חתימת הבודק מההגדרות. כאן המשבצת ריקה לחתימה ידנית. חתימת הבודק מופיעה רק במקומות של הבודק (עמוד השער, החתימה, הפוטר).
- **"פרטי המתקן"** לא מודפסים כסעיף נפרד. הם בעמוד השער, כמו בישן, ולכן המספור בדוח מתחיל ב-01 שנאים.
- **"אישור חשמול"** מודפס בסיכום, לפני ההערות. בישן הוא בבלוק "אישור" שבסוף.
- **מכשירי בדיקה:** בדיקות לפני הפקה מתריעות על כיול שפג (שגיאה) או שיפוג תוך 60 יום (אזהרה). בישן זו חלונית נפרדת.
- **הדפסה:** לפני הדפסה ממתינים שכל התמונות ייטענו. לוגו, חתימה ותמונות ענן מורדים לנתונים מקומיים, כך שאין קישורים פגי תוקף ב-PDF (כמו התיקון בישן v2.368).

**נבדק:** 136 בדיקות יחידה, ובדיקה בדפדפן מול Supabase מדומה (כל הבקשות מיורטות בדפדפן, אפס בקשות לענן אמיתי). התרחיש: דוח חדש, 2 תמונות לפני היצירה (ממתינות), שמירה (INSERT), העלאה אוטומטית, שמירה מותנית של הנתיבים, תצוגה מקדימה, PDF של 4 עמודים.
**לא נבדק:** מול Supabase האמיתי. בפרט לא נבדקו הרשאות הדלי וה-RLS בהעלאה מ-`/app/`.

## לוח חשמל ראשי — מה הועבר
נשמר ב-`report_data.mainPanelReport`, באותו מבנה כמו בישן. הערות לפריטים נשמרות ב-`itemNotes`, במפתח `mainPanelReport.mainSwitchgear.checklist|i`.

| חלק | קובץ |
|---|---|
| שירות: מבנה, נרמול, ליקויים (`hasMainPanelDefect`), בדיקות לפני הפקה, פלט | `services/reports/types/mainPanel.service.ts` |
| בדיקות בידוד DAR / PI / ערך בודד (משותף) | `services/shared/insulation.ts`, `components/shared-sections/InsulationEditor.tsx` |
| הצהרת חשמלאי לתיקון ליקוי (משותף) | `services/shared/defectRepair.ts` |
| עורך | `features/reports/MAIN_PANEL/MainPanelEditor.tsx` |
| כרטיסים משותפים לכל העורכים | `components/shared-sections/CommonCards.tsx` |

מה הישנה עורכת ומדפיסה בפועל, ומה הועבר:
- **מסדר מתח גבוה:** פרטים, 3 משני זרם, ו-35 פריטי בדיקה ויזואלית.
- **תאי מתח גבוה.**
- **בדיקות בידוד.**
- **ממצאים מסכמים.**
- **מודולים משותפים:** ממסרים, תמונות, אישור חשמול, הצהרת חשמלאי, תיקון ליקוי.

**שים לב:** בישן `facilities[]` (לוחות עם ספקי כוח, מפסקים, פריטי בדיקה ותאי CT) ו-`mainSwitchgear.panelRows` מחושבים בקוד העורך אבל **לא מוצגים ולא מודפסים** (`facilitiesHtml` לא נכלל ב-HTML שמוחזר). לכן הם לא נערכים כאן. הם נשמרים כמו שהם, וליקוי "X" בהם עדיין נספר כליקוי, כמו בישן.

הבדל מכוון: הערות לפריטי הבדיקה הוויזואלית נכתבות בישן אבל לא מודפסות. כאן הן מודפסות בעמודת "הערות".

## מסך ראשי, התחברות ופריסה
- `features/report-screen/ReportScreen.tsx` הוא מסך אחד לכל הסוגים שהועברו (`editors.tsx`): טיוטות עם סינון לפי סוג, חיפוש ורענון; דוח חדש והדגמה לכל סוג; עורך, תצוגה והדפסה.
- `features/auth/LoginScreen.tsx`: התחברות באימייל וסיסמה (אותו חשבון). Preview בדומיין אחר לא חולק התחברות עם הישנה.
- `src/config.ts`: ברירת מחדל לפרויקט ולמפתח הציבורי של הישנה. קישורי "האפליקציה הקיימת" מפנים ל-`https://shked.vercel.app/`.
- פריסה ו-PWA: ראה `docs/DEPLOY.md`.

## עבודה מרובת משתמשים — איך העורך מתנהג (אחרי סקירה)
- **בדיקת עדכניות:** בחזרה לטאב, בחזרת רשת, וכל 45 שנ׳ (קריאה בלבד). אם בענן יש גרסה חדשה ואין כאן שינויים, היא נטענת עם הודעה. אם יש כאן שינויים, חלונית הקונפליקט נפתחת מיד ולא רק בשמירה הבאה.
- **"ביטול" בחלונית:** השמירה האוטומטית מושהית עד לחיצה על "שמור". בעבר החלונית נפתחה שוב כל 5 שניות.
- **שמירה בלי שינויים לא נשלחת:** אחרת היא מעדכנת את `updated_at` ויוצרת קונפליקט מיותר אצל בודק אחר.
- **"טען גרסת ענן":** הגרסה המקומית שנדחתה נשמרת במכשיר (`app-report-discarded:<id>`).
- **"שמור כעותק":** הגיבוי המקומי של המקור מתנקה, כי השינויים עברו לעותק.
- **פתיחת דוח עם שינויים מקומיים שלא נשמרו:** נפתחת הגרסה המקומית, ואם הענן התקדם נפתחת חלונית השוואה. בעבר השינויים המקומיים נזרקו בשקט כשגרסת הענן השתנתה.
- **אזהרת נוכחות:** אם מכשיר אחר שמר את הדוח ב-15 הדקות האחרונות, מוצג באנר "ייתכן שבודק אחר עובד עליו". ברשימת הטיוטות מסומן "נשמר לאחרונה במכשיר אחר" ו"יש במכשיר הזה שינויים שלא נשמרו".
- **השמירה האוטומטית:** 5 שנ׳ אחרי העריכה האחרונה, ולא יותר מ-30 שנ׳ בהקלדה רציפה. ניסיון חוזר אחרי חזרת רשת או כישלון.
- **אזהרה בסגירת טאב** עם שינויים שלא הגיעו לענן.
- **גיבוי מקומי:** נכתב 0.7 שנ׳ אחרי העריכה ולא בכל הקשה, ובלי base64 של תמונות שכבר בענן (כמו בישן). אם האחסון מלא, מוצגת אזהרה.
- **רשימת הטיוטות** לא מורידה את `report_data` המלא (תמונות) לכל טיוטה.

התחברות: `/app/` ו-`/` באותו דומיין חולקות את ההתחברות של Supabase. מי שמחובר בישנה מחובר גם כאן. מזהה המכשיר (`rdDeviceId`) ומונה מספרי הדוחות (`report-counter`) משותפים גם הם.

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
2. בדיקה ידנית של דוח שנאי אמיתי מול הענן: פתיחה ב-`/app/`, עריכה, צילום תמונה, שמירה, הדפסה, ופתיחה שוב בישנה.
3. העברת סוג הדוח הבא (המודולים המשותפים — שער, תמונות, הצהרות, ממסרים, בידוד, תיקון ליקוי — כבר מוכנים); הוספה ל-`features/report-screen/editors.tsx`.
4. Vercel: rewrite של `/app/*` ל-`dist/app/index.html`; האפליקציה הישנה ב-`/` ללא שינוי.
5. להמשיך סוג אחר סוג לפי שימוש.
