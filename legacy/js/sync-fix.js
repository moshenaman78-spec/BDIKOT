/*
 * sync-fix.js — תיקון סנכרון בין מכשירים (נטען אחרי js/app.js ו-js/nav.js).
 * גרסת תיקון: 2.2.552-sync1
 *
 * הבעיה (שוחזרה): דוח חדש שנפתח אוטומטית במכשיר מקבל זהות ענן עם "ייווצר בענן רק כשיוזן תוכן"
 * (cloudInsertRequiresContent). "תוכן" נבדק רק לפי שם אתר / לקוח / כתובת / תמונות
 * (hasMeaningfulReportData). דוח שמתחילים בו מנתוני ממירים/לוחות/מדידות — לא נוצר בענן לעולם,
 * בזמן שהחיווי מציג "נשמר". לכן הוא לא מופיע בטיוטות במכשיר אחר.
 * בנוסף: מסך "דוחות טיוטה בענן" הציג רשימה שנטענה מקודם (לא רענן בכניסה), כך שדוח חדש ממכשיר
 * אחר לא הופיע עד רענון ידני.
 *
 * התיקון (בלי לשנות את app.js — מחליף פונקציות גלובליות בלבד):
 *  1. כל עריכה אמיתית בדוח (כל שדה, כולל ממירים ומדידות) מסמנת את הדוח כ"יש תוכן" → נוצר בענן
 *     בשמירה האוטומטית הבאה (אותו INSERT בדיוק, עם ה-UUID שכבר נקבע — בלי כפילויות).
 *  2. דוחות שכבר "תקועים" כך במכשיר — מזוהים בפתיחה ונשלחים לענן.
 *  3. החיווי אומר את האמת: "נשמר במכשיר בלבד" כשהדוח לא בענן, במקום "נשמר".
 *  4. מסך הטיוטות מרענן מהענן בכל כניסה ובחזרה לאפליקציה.
 * כללי השמירה לא משתנים: אין דריסה (UPDATE מותנה), אין ארכוב, אין מספר חדש לדוח קיים.
 */
(function () {
  'use strict';
  if (typeof scheduleSave !== 'function' || typeof saveReportToCloud !== 'function') return; // app.js לא נטען

  var FIX_VERSION = '2.2.552-sync1';
  try { window.__shkSyncFix = FIX_VERSION; } catch (e) { /* */ }

  // ---------- 1+2: זיהוי "יש תוכן" ----------
  var SKIP = { settings: 1, meta: 1, id: 1, num: 1, collapsed: 1, reportChapters: 1, activeChapterIndex: 1, primaryChapterBackup: 1, aiSummary: 1, declarationsOn: 1, showElectricianDeclaration: 1, electricianDeclarationText: 1, panelOrder: 1 };
  var ID_RE = /^panel_[a-z0-9]+$/;
  // מנרמל: מסיר שדות טכניים, ומחליף אובייקטים שמפתחותיהם מזהים (panel_xxx) ברשימת ערכים ממוינת
  function norm(v) {
    if (Array.isArray(v)) return v.map(norm);
    if (v && typeof v === 'object') {
      var keys = Object.keys(v);
      if (keys.length && keys.every(function (k) { return ID_RE.test(k); })) {
        return keys.map(function (k) { return JSON.stringify(norm(v[k])); }).sort();
      }
      var o = {};
      keys.forEach(function (k) { if (!SKIP[k]) o[k] = norm(v[k]); });
      return o;
    }
    if (typeof v === 'string' && ID_RE.test(v)) return 'ID';
    return v;
  }
  function metaHasContent(m) {
    if (!m) return false;
    return !!(m.siteName || m.client || m.address || m.project || m.description || m.attentionTo || m.requester);
  }
  // true = המשתמש הזין משהו בדוח (מעבר לברירות המחדל של דוח ריק מאותו סוג)
  function hasUserContent() {
    try {
      if (hasMeaningfulReportData()) return true;
      if (metaHasContent(state.meta)) return true;
      if (Array.isArray(state.notes) && state.notes.some(function (n) { return n && String(n).trim(); })) return true;
      if (state.customDeclaration && String(state.customDeclaration).trim()) return true;
      var fresh = newState();
      fresh.settings.formTypeName = state.settings.formTypeName;
      return JSON.stringify(norm(state)) !== JSON.stringify(norm(fresh));
    } catch (e) { return false; }
  }
  function releaseIfContent() {
    var s = state && state.settings;
    if (!s || !s.cloudReportId || !s.cloudInsertPending || !s.cloudInsertRequiresContent) return false;
    if (!hasUserContent()) return false;
    s.cloudInsertRequiresContent = false; // הדוח אמיתי — ייווצר בענן בשמירה האוטומטית הבאה
    return true;
  }

  // ---------- 3: חיווי אמין ----------
  function isLoggedIn() { try { return !!(supabaseClient && cloudCurrentUser); } catch (e) { return false; } }
  function notInCloudText() {
    var s = state && state.settings;
    if (!s) return null;
    if (!isLoggedIn()) return (typeof cloudAuthCheckComplete !== 'undefined' && cloudAuthCheckComplete) ? 'נשמר במכשיר בלבד — לא מחובר לענן' : null;
    if (!s.cloudReportId) return 'הדוח לא בענן — לחץ 💾 שמור כדי להעלות';
    if (s.cloudInsertPending && s.cloudInsertRequiresContent) return 'נשמר במכשיר — יעלה לענן כשתזין נתונים';
    return null;
  }

  var origScheduleSave = scheduleSave;
  scheduleSave = function () {
    releaseIfContent(); // לפני השמירה — כך השמירה האוטומטית שתתוזמן כבר תיצור את הדוח בענן
    var r = origScheduleSave.apply(this, arguments);
    setTimeout(function () {
      var t = notInCloudText();
      if (t && /^נשמר$/.test((document.getElementById('savePill') || {}).textContent || '')) setSavePill(t, false, true);
    }, 650);
    return r;
  };
  try { window.scheduleSave = scheduleSave; } catch (e) { /* */ }

  scheduleCloudAutoSave = async function () {
    if (navigator.onLine === false) { queueOfflineSave(); return; }
    releaseIfContent();
    setSavePill('מסנכרן לענן…', false);
    var result = await saveReportToCloud();
    if (result === true) setSavePill('נשמר בענן ✓', true);
    else if (result === 'conflict') setSavePill('קונפליקט — לא נשמר בענן', false);
    else if (result === 'offline') setSavePill('אין חיבור – נשמר מקומית וממתין לסנכרון', false, true);
    else if (result === 'queued') setSavePill('מסנכרן לענן…', false);
    else if (result === 'empty') setSavePill('נשמר במכשיר — יעלה לענן כשתזין נתונים', false, true);
    else setSavePill(notInCloudText() || 'שגיאה בשמירה בענן — הנתונים שמורים במכשיר', false);
  };
  try { window.scheduleCloudAutoSave = scheduleCloudAutoSave; } catch (e) { /* */ }

  // לחיצה על "הדוח לא נשמר בענן — לחץ לשמירה" (nav.js) קוראת ל-saveReportToCloud — לפני כן משחררים
  var origSaveReportToCloud = saveReportToCloud;
  saveReportToCloud = function () { releaseIfContent(); return origSaveReportToCloud.apply(this, arguments); };
  try { window.saveReportToCloud = saveReportToCloud; } catch (e) { /* */ }

  // ---------- 2: דוח "תקוע" מגרסה קודמת — בפתיחה ----------
  function rescueStuck() {
    if (!isLoggedIn()) return;
    if (releaseIfContent()) {
      try { showToast('הדוח הפתוח נשלח לענן — עכשיו הוא יופיע גם במכשירים האחרים'); } catch (e) { /* */ }
      scheduleSave();
    }
  }
  var tries = 0;
  var startTimer = setInterval(function () {
    tries++;
    var ready = typeof cloudAuthCheckComplete !== 'undefined' && cloudAuthCheckComplete;
    if (ready || tries > 40) { clearInterval(startTimer); if (ready) setTimeout(rescueStuck, 1500); }
  }, 500);

  // ---------- 4: טיוטות בענן — תמיד מהענן ----------
  function refreshDraftsIfOpen() {
    try { if (activeTab === 'drafts') loadCloudDraftsIfNeeded(true); } catch (e) { /* */ }
  }
  var draftsBtn = document.getElementById('tabDrafts');
  if (draftsBtn) draftsBtn.addEventListener('click', function () { setTimeout(function () { try { loadCloudDraftsIfNeeded(true); } catch (e) { /* */ } }, 0); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') { refreshDraftsIfOpen(); rescueStuck(); } });
  window.addEventListener('online', function () { refreshDraftsIfOpen(); rescueStuck(); });
})();
