# פריסה ל-Vercel (Preview בלבד) והתקנה בטלפון/טאבלט

## מה מוכן בקוד
| קובץ | מה עושה |
|---|---|
| `vercel.json` | `npm ci` → `npm run build` → מגיש את `dist/`. האפליקציה ב-`/app/`; הכתובות `/` ו-`/app` מפנות ל-`/app/`. כל נתיב תחת `/app/` שאינו קובץ מוגש עם `index.html`. קבצי build במטמון לשנה (יש hash בשם). `sw.js`, `index.html` ו-manifest בלי מטמון, כדי שעדכון יגיע מיד. |
| `public/manifest.webmanifest` | PWA: שם, RTL, `scope`/`start_url` = `/app/`, תצוגת `standalone`, אייקונים 192/512 ו-maskable. |
| `public/sw.js` | Service Worker: מעטפת האפליקציה נטענת גם בלי רשת, קבצי build מהמטמון. **לא שומר במטמון שום בקשה ל-Supabase**. |
| `public/icons/*` | אייקונים (אנדרואיד, iPhone, favicon). |
| `index.html` | meta ל-iPhone (מסך מלא, שם, אייקון), `viewport-fit=cover`, וקישור ל-manifest עם `crossorigin="use-credentials"`, כדי שיעבוד גם כש-Preview מוגן. |
| `src/config.ts` | ברירת המחדל היא אותו פרויקט Supabase ואותו מפתח ציבורי (anon) כמו באפליקציה הקיימת. לא צריך משתני סביבה. |

נבדק מקומית: build עובר. Chromium מדווח 0 שגיאות manifest ו-0 שגיאות התקנה. ה-Service Worker שולט בדף, והמעטפת נטענת גם במצב לא-מקוון (טלפון וטאבלט מדומים).
**לא בוצעה פריסה ל-Vercel.** לא production ולא preview.

## מה משה צריך לעשות (חד-פעמי)
1. **פרויקט Vercel חדש, נפרד** (למשל `shked-app`) שמחובר לריפו `moshenaman78-spec/BDIKOT`.
   - **לא לחבר את הריפו לפרויקט `shked` הקיים**: הוא ידרוס את האפליקציה הקיימת ב-`shked.vercel.app`.
   - Framework: Other. ההגדרות נלקחות מ-`vercel.json`. משתני סביבה: לא נדרשים.
   - כל push לענף `claude/vigilant-tesla-0iutv4` ייצור Preview עם כתובת משלו.
2. **הגנת Preview:** כברירת מחדל Vercel מגן על Preview ב-"Vercel Authentication". כך כל בודק צריך חשבון Vercel בצוות, וההתקנה כאפליקציה בטלפון עלולה להיכשל. אפשרויות:
   - לכבות: Project → Settings → Deployment Protection → Vercel Authentication → Disabled (ל-Preview).
   - או לשתף קישור עוקף (Shareable Link) מדף הפריסה.
3. **Supabase:** אין צורך בשינוי. ההתחברות באימייל וסיסמה עובדת מכל דומיין עם המפתח הציבורי. ההרשאות (RLS) ודלי `report-files` זהים לאפליקציה הקיימת.
   - **לבדוק פעם אחת:** שבודק רגיל (לא מנהל) יכול להעלות תמונה ולשמור דוח מה-Preview.
4. **Production (בהמשך, אחרי אישור):** כדי שהאפליקציה תהיה תחת `shked.vercel.app/app/` (ואז ההתחברות משותפת עם הקיימת), מוסיפים בפרויקט `shked` הקיים rewrite: `/app/:path*` → `https://<shked-app>.vercel.app/app/:path*`. לחלופין, דומיין משנה נפרד.

## התקנה במכשירים
- **אנדרואיד (Chrome):** לפתוח את כתובת ה-Preview ← תפריט ⋮ ← "התקנת אפליקציה" / "הוספה למסך הבית".
- **iPhone / iPad (Safari):** כפתור השיתוף ← "הוספה למסך הבית". ב-iOS עובדים רק דרך Safari.
- **מחשב (Chrome/Edge):** אייקון ההתקנה בשורת הכתובת.
- **אחרי עדכון:** האפליקציה טוענת את הגרסה החדשה בפתיחה הבאה. אם לא, סוגרים ופותחים מחדש.

## מה לא עובד בלי רשת
המעטפת נטענת, אבל רשימת הטיוטות, פתיחת דוח והעלאת תמונות דורשות חיבור.
דוח שכבר פתוח ממשיך להיערך. השינויים נשמרים בגיבוי במכשיר ונשלחים לענן כשהחיבור חוזר.
