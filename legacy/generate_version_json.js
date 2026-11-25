// מייצר את version.json ישירות מתוך APP_VERSION/CHANGELOG בפועל בקוד (js/app.js) — נמנע
// מאי-התאמה ידנית בין הקובץ הנפרד לתוכן האמיתי. חובה להריץ את הסקריפט הזה בכל פעם שנבנה
// ZIP חדש להעלאה, אחרת מודל "עדכון זמין" יזהה גרסה שגויה/ישנה (בדיוק הבאג שתוקן ב-v2.153).
//
// שימוש: node generate_version_json.js
//
// מעדיף CHANGELOG[0].userSummary (תקציר קצר וידידותי למשתמש קצה) על פני .notes (תיעוד טכני
// מפורט לצורך אימות/ביקורת פנימית) — האחרון משמש רק כגיבוי אם אין עדיין תקציר קצר לרשומה.

const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, 'js', 'app.js');
const content = fs.readFileSync(appJsPath, 'utf-8');

const versionMatch = content.match(/^const APP_VERSION = "([^"]+)";/m);
if(!versionMatch){
  console.error('שגיאה: לא נמצא APP_VERSION ב-js/app.js');
  process.exit(1);
}
const version = versionMatch[1];

// מוצאים את הרשומה הראשונה (העדכנית ביותר) ב-CHANGELOG — פשוט מוצאים את השורה שמתחילה
// ב-{ version: "X.Y" מיד אחרי const CHANGELOG = [
const changelogStart = content.indexOf('const CHANGELOG = [');
if(changelogStart === -1){
  console.error('שגיאה: לא נמצא CHANGELOG ב-js/app.js');
  process.exit(1);
}
const afterStart = content.slice(changelogStart);
const firstEntryMatch = afterStart.match(/\{\s*version:\s*"([^"]+)",\s*date:\s*"([^"]+)",\s*(?:userSummary:\s*"((?:[^"\\]|\\.)*)",\s*)?notes:\s*"((?:[^"\\]|\\.)*)"\s*\}/);
if(!firstEntryMatch){
  console.error('שגיאה: לא הצליח לפרסר את רשומת ה-CHANGELOG הראשונה');
  process.exit(1);
}
const [, entryVersion, , userSummary, notes] = firstEntryMatch;

if(entryVersion !== version){
  console.warn(`אזהרה: APP_VERSION (${version}) לא תואם לגרסה הראשונה ב-CHANGELOG (${entryVersion}) — ממשיך עם APP_VERSION.`);
}

// unescape פשוט לתווים הנפוצים שנכתבים עם backslash בתוך מחרוזת JS (\" ו-\\)
function unescapeJsString(s){
  return s.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

const finalNotes = userSummary ? unescapeJsString(userSummary) : unescapeJsString(notes);

const output = { version, notes: finalNotes, userSummary: userSummary ? unescapeJsString(userSummary) : '' };

fs.writeFileSync(path.join(__dirname, 'version.json'), JSON.stringify(output, null, 2) + '\n', 'utf-8');
console.log(`version.json נוצר בהצלחה: v${version}`);
console.log(`תקציר שנכתב: ${finalNotes.slice(0, 100)}${finalNotes.length > 100 ? '...' : ''}`);

// מעדכן גם את ה-cache-busting query parameter על תגית ה-script של app.js ב-index.html —
// בלי זה, דפדפנים (בעיקר במובייל, שנוטה למטמן קבצים סטטיים באגרסיביות רבה יותר) עלולים
// להמשיך להגיש עותק ישן ומטומן של app.js גם אחרי פריסה חדשה, כי כתובת ה-URL זהה בכל גרסה.
const indexPath = path.join(__dirname, 'index.html');
const indexContent = fs.readFileSync(indexPath, 'utf-8');
const scriptTagRegex = /<script src="js\/app\.js(?:\?v=[^"]*)?"><\/script>/;
const cssTagRegex = /<link rel="stylesheet" href="css\/style\.css(?:\?v=[^"]*)?">/;
let updatedIndex = indexContent;
if(!scriptTagRegex.test(indexContent)){
  console.warn('אזהרה: לא נמצאה תגית <script src="js/app.js..."> ב-index.html — לא עודכן cache-busting.');
}else{
  updatedIndex = updatedIndex.replace(scriptTagRegex, `<script src="js/app.js?v=${version}"></script>`);
  console.log(`index.html עודכן: js/app.js?v=${version}`);
}
// אותו cache-busting גם ל-css/style.css — היה חסר לגמרי עד עכשיו (רק app.js טופל). זה לא
// שיחק תפקיד עד לתיקון הראשון ב-style.css בסשן הזה (v2.248, תיקון תצוגת מובייל) — בלי זה,
// בדיוק אותה בעיית מטמון אגרסיבי במובייל שההערה למעלה מזהירה מפניה לגבי app.js הייתה עלולה
// למנוע מהתיקון עצמו (שקשור למובייל!) להיטען אצל המשתמש בפועל.
if(!cssTagRegex.test(indexContent)){
  console.warn('אזהרה: לא נמצאה תגית <link href="css/style.css..."> ב-index.html — לא עודכן cache-busting ל-CSS.');
}else{
  updatedIndex = updatedIndex.replace(cssTagRegex, `<link rel="stylesheet" href="css/style.css?v=${version}">`);
  console.log(`index.html עודכן: css/style.css?v=${version}`);
}
fs.writeFileSync(indexPath, updatedIndex, 'utf-8');
