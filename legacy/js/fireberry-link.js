/*
 * fireberry-link.js — קישור ל-Fireberry ברגע בחירת הלקוח, ושמירת הדוח אצל הלקוח ב-Fireberry.
 *  1. כשבוחרים לקוח קיים בשדה "המזמין" (הקלדה, רשימה או חלונית החיפוש) — נשאלים פעם אחת:
 *       • הלקוח מקושר ל-Fireberry → "לקשר את הדוח ללקוח X ב-Fireberry?" (כן/לא)
 *       • הלקוח לא מקושר → "לחפש אותו ב-Fireberry ולקשר?" → נפתחת חלונית החיפוש עם השם.
 *     עד עכשיו הקישור קרה בשקט (בלי לשאול) או רק דרך כפתור נפרד.
 *  2. בסיום ("Fireberry" בתצוגה המקדימה) — דוח מקושר נשמר אצל הלקוח ב-Fireberry כשני קבצים:
 *     PDF של הדוח + קובץ הדוח המלא של התוכנה (JSON, אותו קובץ כמו הגיבוי — אפשר לפתוח ממנו את הדוח).
 *     קודם נשלח רק JSON חלקי (פרטי עמוד השער).
 * נטען אחרי app.js; לא משנה את app.js. אותה פונקציית ענן fireberry-sync-report (אין שינוי בשרת).
 */
(function () {
  'use strict';
  if (typeof renderInner !== 'function' || typeof executeFireberrySync !== 'function') return;

  var lastRid = null, lastClient = null, timer = null, asking = false;
  function loggedIn() { try { return !!(supabaseClient && cloudCurrentUser); } catch (e) { return false; } }
  function cloudClient(name) { try { return (cloudClientsCache || []).find(function (c) { return c.name === name; }) || null; } catch (e) { return null; } }

  async function ask(name) {
    if (asking || state.meta.client !== name || !loggedIn()) return;
    var m = state.meta;
    if (m.fireberryAskedFor === name) return;                                    // כבר נשאל על הלקוח הזה בדוח הזה
    if (m.fireberrySyncMode && m.fireberryClientName === name && m.fireberryClientId) return; // כבר מקושר אליו
    var raw = cloudClient(name); if (!raw) return;                               // שם חדש שעוד לא לקוח — לא שואלים
    asking = true;
    try {
      m.fireberryAskedFor = name;
      if (raw.fireberry_client_id) {
        var yes = await showAppConfirm('לקשר את הדוח ללקוח "' + name + '" ב-Fireberry?\n\nבסיום, הדוח יישמר אצל הלקוח ב-Fireberry: קובץ PDF + קובץ הדוח של התוכנה.');
        if (state.meta.client !== name) return;
        if (yes) {
          m.fireberrySyncMode = 'client';
          m.fireberryClientId = raw.fireberry_client_id;
          m.fireberryClientName = name;
          m.fireberryMeetingId = ''; m.fireberryMeetingSubject = ''; m.fireberryMeetingStart = ''; m.fireberryMeetingEnd = '';
          m.fireberrySaveFiles = true;
          try { if (raw.id) state.settings.cloudClientId = raw.id; } catch (e) { /* */ }
          showToast('הדוח קושר ללקוח "' + name + '" ב-Fireberry');
        } else {
          m.fireberryClientId = ''; m.fireberryClientName = ''; m.fireberrySyncMode = ''; m.fireberrySaveFiles = false;
        }
        scheduleSave(); render();
      } else {
        scheduleSave();
        var search = await showAppConfirm('הלקוח "' + name + '" עדיין לא מקושר ל-Fireberry.\n\nלחפש אותו ב-Fireberry ולקשר? (בסיום הדוח יישמר אצלו: PDF + קובץ הדוח)');
        if (!search || state.meta.client !== name) return;
        openFireberryUnifiedModal(); fbUnifiedGoTo('client');
        setTimeout(function () {
          var inp = document.getElementById('fbUnifiedClientSearchInput');
          var btn = document.querySelector('[data-fbunifiedclientsearchbtn]');
          if (inp) { inp.value = name; inp.dispatchEvent(new Event('input', { bubbles: true })); }
          if (btn && name.length >= 2) btn.click();
        }, 50);
      }
    } finally { asking = false; }
  }

  function watch() {
    var rid = (state.settings && state.settings.cloudReportId) || '';
    var client = (state.meta && state.meta.client) || '';
    if (rid !== lastRid) { lastRid = rid; lastClient = client; return; }   // דוח אחר נפתח — לא שואלים על לקוח קיים
    if (client === lastClient) return;
    lastClient = client;
    clearTimeout(timer);
    if (client) timer = setTimeout(function () { ask(client); }, 700);     // ממתינים שהבחירה תתייצב
  }
  var orig = renderInner;
  renderInner = function () { var r = orig.apply(this, arguments); try { watch(); } catch (e) { /* */ } return r; };
  // בחירה מהרשימה בלי render (קורה בהקלדה) — בודקים גם על שינוי בשדה
  document.addEventListener('change', function (e) { if (e.target && e.target.matches && e.target.matches('[data-clienttextselect]')) setTimeout(watch, 0); }, true);
  try { watch(); } catch (e) { /* */ }

  // דוח שקושר ללקוח דרך החלונית (מסלול "לא מקושר → חיפוש") — גם הוא נשמר אצל הלקוח

  // ---------- סיום: ברירת מחדל = לשמור אצל הלקוח PDF + קובץ הדוח ----------
  var origOpen = openFireberryFinalizeModal;
  openFireberryFinalizeModal = function () {
    try {
      if (state.meta.fireberryClientId && state.meta.fireberrySaveFiles !== false) {
        fireberrySyncEnabled = true; fireberrySaveToClient = true; fireberryBackupJsonOpt = true;
      }
    } catch (e) { /* */ }
    return origOpen.apply(this, arguments);
  };

  // אותה פונקציה כמו ב-app.js, בהבדל אחד: jsonContent = קובץ הדוח המלא (כמו בגיבוי), לא רק פרטי השער.
  executeFireberrySync = async function () {
    if (!fireberrySyncEnabled) { return; }
    fireberrySyncing = true; fireberrySyncResult = null; render();
    try {
      var clientId = await resolveFireberryClientId();
      if (!clientId) { fireberrySyncResult = { status: 'failed', errors: { client: fireberryClientResolveError || 'לא ניתן לזהות לקוח' } }; return; }
      var pdfBase64 = await buildReportPdfBase64();
      var filename = buildReportFilename();
      var jsonContent = null;
      if (fireberryBackupJsonOpt) {
        jsonContent = JSON.stringify(sanitizeStateForLocalSave(state), null, 2);
      }
      var token = await getFireberrySessionToken();
      if (!token) { fireberrySyncResult = { status: 'failed', errors: { client: 'לא מחובר' } }; return; }
      var resp = await fetch(state.settings.supabaseUrl + '/functions/v1/fireberry-sync-report', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fireberryClientId: clientId,
          fireberryMeetingId: fireberryLinkToMeeting ? fireberrySelectedMeetingId : '',
          pdfBase64: pdfBase64, pdfFilename: filename + '.pdf',
          jsonContent: jsonContent, jsonFilename: filename + '_קובץ-דוח.json',
          saveToClient: fireberrySaveToClient,
          linkToMeeting: fireberryLinkToMeeting,
          attachPdfToMeeting: fireberryAttachPdfToMeeting,
          backupJson: fireberryBackupJsonOpt,
          alreadySynced: {
            client: !!state.meta.fireberryClientFileSynced,
            meeting: !!state.meta.fireberryMeetingFileSynced,
            json: !!state.meta.fireberryJsonSynced
          }
        })
      });
      var body = await resp.json();
      if (!resp.ok || body.error) { fireberrySyncResult = { status: 'failed', errors: { client: body.error || ('שגיאה (' + resp.status + ')') } }; return; }
      state.meta.fireberryClientFileSynced = !!body.clientFileSynced;
      state.meta.fireberryMeetingFileSynced = !!body.meetingFileSynced;
      state.meta.fireberryJsonSynced = !!body.jsonSynced;
      state.meta.fireberrySyncStatus = body.status;
      state.meta.fireberryLastError = JSON.stringify(body.errors || {});
      if (fireberryLinkToMeeting && fireberrySelectedMeetingId) {
        var mt = fireberryMeetingsFound.find(function (x) { return x.fireberryMeetingId === fireberrySelectedMeetingId; });
        state.meta.fireberryMeetingId = fireberrySelectedMeetingId;
        if (mt) { state.meta.fireberryMeetingSubject = mt.subject; state.meta.fireberryMeetingStart = mt.start; state.meta.fireberryMeetingEnd = mt.end; }
      }
      scheduleSave();
      fireberrySyncResult = body;
      if (body.clientFileSynced && body.jsonSynced) showToast('נשמר ב-Fireberry אצל הלקוח: PDF + קובץ הדוח ✓');
    } catch (err) {
      fireberrySyncResult = { status: 'failed', errors: { client: err && err.message ? err.message : String(err) } };
    } finally {
      fireberrySyncing = false; render();
      renderFireberryFinalizeModalBody();
    }
  };
})();
