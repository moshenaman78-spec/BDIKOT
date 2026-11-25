/*
 * sma-capacitor.js — דוח "טיפול בממירי SMA": סעיף חדש "פרטי קבל מתח גבוה" (כולל בדיקה ויזואלית),
 * מיד אחרי "05 בדיקת שנאי". נטען אחרי js/app.js (לא משנה את app.js — עוטף פונקציות גלובליות).
 * נתונים: state.hvCapacitors = [ { ...פרטי לוחית יצרן, checklist, מדידות, sectionNotes } ]
 * תאימות: דוח ישן בלי השדה מקבל ברירת מחדל (mergeDefaults מבוסס newState). אפליקציה ישנה שתפתח
 * דוח חדש פשוט תתעלם מהשדה ותשמור אותו כמו שהוא (מיזוג רדוד שומר מפתחות לא מוכרים).
 */
(function () {
  'use strict';
  if (typeof renderStandaloneTransformerUnit !== 'function' || typeof buildReportBlocks !== 'function' || typeof newState !== 'function') return;

  var CAP_CHECKLIST = [
    'בדיקה ויזואלית כללית — שלמות מעטפת הקבל',
    'סימני נזילה / ניפוח (התנפחות) של יחידות הקבל',
    'סריקה תרמוגרפית',
    'ניקיון ושלמות מבדדים ומעברים (Bushings)',
    'חיזוק ברגים וחיבורים (מד-מומנט)',
    'בדיקת הארקות',
    'שלמות נתיכי / מפסקי הגנה ומגענים',
    'קיום ותקינות נגדי פריקה',
    'קורוזיה וחלודה',
    'אוורור וטמפרטורת סביבה',
    'מרחקי בטיחות, גידור ושילוט אזהרה',
    'שלט יצרן קריא ותואם'
  ];
  var CAP_MEAS = [
    ['capL1', 'קיבול L1 (µF)'], ['capL2', 'קיבול L2 (µF)'], ['capL3', 'קיבול L3 (µF)'],
    ['currentL1', 'זרם L1 (A)'], ['currentL2', 'זרם L2 (A)'], ['currentL3', 'זרם L3 (A)'],
    ['insulationToGround', 'התנגדות בידוד לאדמה (MΩ)']
  ];
  var INFO = [
    ['name', 'שם / ייעוד הקבל'], ['manufacturer', 'יצרן'], ['codeNo', 'קוד (Code No)'], ['referenceNo', 'מק"ט (Reference No)'],
    ['serialNo', 'מספר סידורי'], ['year', 'שנת ייצור'], ['ratedPower', 'הספק נקוב (kvar)'], ['ratedVoltage', 'מתח נקוב (kV)'],
    ['ratedCurrent', 'זרם נקוב (A)'], ['ratedFrequency', 'תדר נקוב (Hz)'], ['steps', 'הרכב דרגות (Steps)'],
    ['insulationLevel', 'רמת בידוד (kV)'], ['weight', 'משקל (kg)'], ['ipRating', 'דרגת הגנה IP'],
    ['temperatureRange', 'טווח טמפרטורה'], ['installLocation', 'מיקום התקנה']
  ];
  function makeCap() {
    var c = { ratedFrequency: '50' };
    INFO.forEach(function (f) { if (!(f[0] in c)) c[f[0]] = ''; });
    c.checklist = emptyStatusMap(CAP_CHECKLIST);
    CAP_MEAS.forEach(function (m) { c[m[0]] = ''; });
    c.sectionNotes = '';
    return c;
  }
  function ensure(s) {
    if (!s) return;
    if (!Array.isArray(s.hvCapacitors) || !s.hvCapacitors.length) s.hvCapacitors = [makeCap()];
    s.hvCapacitors = s.hvCapacitors.map(function (c) { var b = makeCap(); var m = Object.assign(b, c || {}); m.checklist = Object.assign(emptyStatusMap(CAP_CHECKLIST), (c && c.checklist) || {}); return m; });
  }
  function val(v) { v = escapeHtml(String(v)); return /[֐-׿]/.test(v) ? v : '<span dir="ltr" style="unicode-bidi:isolate">' + v + '</span>'; }
  var isSma = function () { try { return getReportType() === 'SMA'; } catch (e) { return false; } };

  // ---------- מודל ----------
  var origNewState = newState;
  newState = function () { var s = origNewState.apply(this, arguments); s.hvCapacitors = [makeCap()]; return s; };
  try { if (Array.isArray(CHAPTER_SCOPED_FIELDS) && CHAPTER_SCOPED_FIELDS.indexOf('hvCapacitors') < 0) CHAPTER_SCOPED_FIELDS.push('hvCapacitors'); } catch (e) { /* */ }

  // ---------- מסך עריכה ----------
  function num(off) { return String(off + state.panelOrder.length).padStart(2, '0'); }
  function capCard(c, i, total) {
    var bp = 'hvCapacitors.' + i;
    var title = total === 1 ? '<span class="num">' + num(5) + '</span> פרטי קבל מתח גבוה'
      : (i === 0 ? '<span class="num">' + num(5) + '</span> פרטי קבל מתח גבוה — C1' : 'פרטי קבל מתח גבוה — C' + (i + 1));
    var key = 'hv-capacitor-' + i;
    var f = function (k, lbl, restrict) { return textField(lbl, bp + '.' + k, c[k], 'text', restrict || null); };
    return '\n<section class="card" data-key="' + key + '">' +
      '<div class="card-head" data-toggle="' + key + '"><h2>' + title + '</h2>' +
      '<span style="display:flex; align-items:center; gap:6px;">' +
      '<button type="button" class="del-panel-btn" onclick="event.stopPropagation()" data-duprow="hvCapacitors|' + i + '" title="שכפל את הקבל, כולל פרטיו">📋 שכפל קבל</button>' +
      (total > 1 ? '<button type="button" class="del-panel-btn" onclick="event.stopPropagation()" data-delrow="hvCapacitors|' + i + '" title="מחק קבל זה">✕</button>' : '') +
      '<span class="chev">▾</span></span></div>' +
      '<div class="card-body">' +
      f('name', 'שם / ייעוד הקבל') +
      '<p style="font-size:11.5px; color:var(--text-dim); margin:4px 0 0;">נתוני לוחית היצרן של הקבל:</p>' +
      '<div class="grid2">' +
      f('manufacturer', 'יצרן') + f('codeNo', 'קוד (Code No)', 'alnum-en') + f('referenceNo', 'מק"ט (Reference No)', 'alnum-en') +
      f('serialNo', 'מספר סידורי', 'alnum-en') + f('year', 'שנת ייצור', 'digits') + f('ratedPower', 'הספק נקוב (kvar)', 'decimal') +
      f('ratedVoltage', 'מתח נקוב (kV)', 'decimal') + f('ratedCurrent', 'זרם נקוב (A)', 'decimal') + f('ratedFrequency', 'תדר נקוב (Hz)', 'digits') +
      f('steps', 'הרכב דרגות (Steps)') + f('insulationLevel', 'רמת בידוד (kV)') + f('weight', 'משקל (kg)', 'decimal') +
      f('ipRating', 'דרגת הגנה IP') + f('temperatureRange', 'טווח טמפרטורה') + f('installLocation', 'מיקום התקנה') +
      '</div>' +
      '<div class="subhead">בדיקה ויזואלית — קבל מתח גבוה</div>' +
      itemList(CAP_CHECKLIST, c.checklist, bp + '.checklist') +
      '<div class="subhead">מדידות (אופציונלי)</div>' +
      '<div class="grid2">' + CAP_MEAS.map(function (m) { return f(m[0], m[1], 'decimal'); }).join('') + '</div>' +
      compactSectionNotesField(bp + '.sectionNotes', c.sectionNotes) +
      (i === total - 1 ? '<button type="button" class="add-btn" data-addrow="hvCapacitors|' + escapeAttr(JSON.stringify(makeCap())) + '">+ הוסף קבל מתח גבוה</button>' : '') +
      '</div></section>';
  }
  var origUnit = renderStandaloneTransformerUnit;
  renderStandaloneTransformerUnit = function (unit, basePath, idx, totalCount) {
    var html = origUnit.apply(this, arguments);
    if (idx === totalCount - 1 && isSma()) {
      ensure(state);
      html += state.hvCapacitors.map(function (c, i) { return capCard(c, i, state.hvCapacitors.length); }).join('');
    }
    return html;
  };
  // מספור הסעיפים שאחרי: ציוד בטיחות / הערות / הצהרות זזים ב-1
  var origNext = getSharedSectionsNextNumber;
  getSharedSectionsNextNumber = function () { return isSma() ? 8 + state.panelOrder.length : origNext.apply(this, arguments); };
  var origRenderInner = renderInner;
  renderInner = function () {
    var r = origRenderInner.apply(this, arguments);
    try {
      if (isSma()) {
        var s = document.querySelector('section.card[data-key="safety"] h2 .num'); if (s) s.textContent = num(6);
        var n = document.querySelector('section.card[data-key="notes"] h2 .num'); if (n) n.textContent = num(7);
      }
    } catch (e) { /* */ }
    return r;
  };

  // ---------- PDF / תצוגה מקדימה ----------
  function capBlocks() {
    var list = (state.hvCapacitors || []);
    var out = [];
    list.forEach(function (c, i) {
      var rows = INFO.map(function (f) { return [f[1], c[f[0]]]; }).filter(function (r) { return r[1]; });
      var chk = printItemsTable(CAP_CHECKLIST, c.checklist || {}, 'hvCapacitors.' + i + '.checklist');
      var meas = CAP_MEAS.filter(function (m) { return c[m[0]]; });
      var hasData = INFO.some(function (f) { return f[0] !== 'ratedFrequency' && c[f[0]]; }) || chk || meas.length || c.sectionNotes;
      if (!hasData) return;
      var h = '';
      if (rows.length) h += '<table class="tinfo-table">' + rows.map(function (r) { return '<tr><td class="tinfo-label">' + r[0] + '</td><td>' + val(r[1]) + '</td></tr>'; }).join('') + '</table>';
      if (chk) h += '<h3>בדיקה ויזואלית</h3>' + chk;
      if (meas.length) h += '<h3>מדידות</h3><table class="tinfo-table">' + meas.map(function (m) { return '<tr><td class="tinfo-label">' + m[1] + '</td><td>' + val(c[m[0]]) + '</td></tr>'; }).join('') + '</table>';
      h += printSectionNotesBlock(c.sectionNotes);
      var t = list.length === 1 ? 'פרטי קבל מתח גבוה' : 'פרטי קבל מתח גבוה — C' + (i + 1);
      out.push({ level: 1, sectionKey: 'hv-capacitor-' + i, title: t, html: '<h2>' + t + '</h2>' + h });
    });
    return out;
  }
  var origBlocks = buildReportBlocks;
  buildReportBlocks = function () {
    var blocks = origBlocks.apply(this, arguments);
    try {
      if (!isSma() || !Array.isArray(blocks)) return blocks;
      var extra = capBlocks();
      if (!extra.length) return blocks;
      var at = -1;
      blocks.forEach(function (b, i) { if (b && /^standalone-transformer-/.test(b.sectionKey || '')) at = i; });
      if (at < 0) {
        // אין שנאי בדוח — לפני הסעיף הראשון שבא אחרי "בדיקת שנאי" במסך (ציוד בטיחות / הערות / ממסרים / אישור / תמונות / סיכום)
        var AFTER = /^(safety|notes|protection|relay|approval|general-photos|ai-summary|soil-signature)/;
        var first = -1; blocks.forEach(function (b, i) { if (first < 0 && b && AFTER.test(b.sectionKey || '')) first = i; });
        at = (first < 0 ? blocks.length : first) - 1;
      }
      // מכניסים אחרי הבלוק האחרון של "בדיקת שנאי" (כולל תת-בלוקים שלו ברמה 2)
      var j = at + 1;
      while (j < blocks.length && blocks[j] && blocks[j].level === 2 && /^standalone-transformer-/.test(blocks[j].sectionKey || '')) j++;
      blocks.splice(j, 0, ...extra);
    } catch (e) { /* לא מפילים הפקת PDF בגלל הסעיף החדש */ }
    return blocks;
  };

  try { if (state) ensure(state); } catch (e) { /* */ }
  try { if (isSma() && typeof render === 'function') render(); } catch (e) { /* */ }
})();
