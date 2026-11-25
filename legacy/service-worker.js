// service-worker.js — קיים אך ורק כדי לעמוד בקריטריון ההתקנה (Installability) של דפדפני
// Chromium (Chrome/Edge). הדפדפן לעולם לא מציע להתקין את האתר כאפליקציית Windows עצמאית
// (Standalone), אלא אם יש manifest תקין וגם Service Worker עם fetch handler רשום.
//
// תיקון קריטי (אומת מול הבלוג הרשמי של Chrome for Developers, "Revisiting Chrome's
// installability criteria"): Chrome מתעלם באופן מפורש מ-fetch handler "ריק" (כזה שלא קורא
// ל-event.respondWith() בכלל) — בדיוק כדי למנוע ממפתחים "לעקוף" את הדרישה בלי לספק ערך
// אמיתי. הגרסה הקודמת של הקובץ הזה הייתה בדיוק handler כזה, ולכן לא נחשבה כעומדת בקריטריון
// בפועל, למרות שהייתה רשומה.
//
// חשוב, לפי בקשה מפורשת: "אל תשנה שום פונקציה בדוחות, Supabase, Fireberry או מנגנון
// הסנכרון" — לכן ה-handler כן קורא ל-respondWith(), אבל **בלי שום caching בפועל**: הוא
// פשוט מעביר כל בקשה ישירות לרשת (fetch(event.request)) ומחזיר את התוצאה כמו שהיא. זו
// עדיין "מימוש אמיתי" מבחינת Chrome (לא ריק), אבל מתנהג זהה-לחלוטין ל"בלי caching" —
// כל בקשה ל-Supabase/Fireberry Edge Functions מגיעה בפועל לרשת, בלי סיכון לתגובה מיושנת.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // מימוש אמיתי (לא ריק) — אבל בלי שום cache: פשוט מעביר את הבקשה לרשת כמו שהיא ומחזיר
  // את התוצאה. לא נוגע בשום תגובה, לא שומר כלום, לא מתערב בשום החלטת ניתוב.
  event.respondWith(fetch(event.request));
});
