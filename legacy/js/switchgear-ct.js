/*
 * switchgear-ct.js — דוח SMA: "מסדר מתח גבוה" זהה ל"מסדר מתח גבוה" בדוח לוח מתח גבוה (MAIN_PANEL).
 * ב-MAIN_PANEL פרטי המסדר כוללים שלוש חלוניות משנה זרם (מדידה / הגנה / מסכם) במקום "דרגת הגנה IP".
 * כאן מוסיפים את אותן חלוניות, באותם שדות ובאותו נתיב נתונים (assemblyDetails.measurementCT וכו'), ל:
 *   - סעיף 03 "מסדר מתח גבוה ראשי" (כולל עותקים משוכפלים)
 *   - "פרטי מסדר מתח גבוה" בתוך כל ממיר
 * גם במסך וגם ב-PDF. "דרגת הגנה IP" מוסתר כמו ב-MAIN_PANEL — אלא אם כבר הוזן בו ערך (לא מאבדים נתונים).
 * נטען אחרי app.js; לא משנה את app.js.
 */
(function () {
  'use strict';
  if (typeof renderMainSwitchgearUnit !== 'function' || typeof panelSection !== 'function' || typeof buildReportBlocks !== 'function') return;

  var M = [['type', 'סוג'], ['model', 'דגם'], ['va', 'הספק (VA)'], ['alf', 'ALF'], ['cls', 'CLASS'], ['ratio', 'יחס זרם']];
  var P = [['manufacturer', 'יצרן'], ['model', 'דגם'], ['serialNo', 'מספר סידורי'], ['secondaryCurrent', 'זרם משני (A)']];
  var S = [['type', 'סוג'], ['model', 'דגם'], ['va', 'הספק (VA)'], ['alf', 'ALF'], ['ratio', 'יחס זרם']];
  function blank(list, extra) { var o = {}; list.forEach(function (f) { o[f[0]] = ''; }); (extra || []).forEach(function (k) { o[k] = ''; }); return o; }
  function ensureCT(ad) {
    if (!ad || typeof ad !== 'object') return ad;
    ad.measurementCT = Object.assign(blank(M), ad.measurementCT || {});
    ad.protectionCT = Object.assign(blank(P, ['busbarWithstand']), ad.protectionCT || {});
    ad.summaryCT = Object.assign(blank(S), ad.summaryCT || {});
    return ad;
  }
  var isSma = function () { try { return getReportType() === 'SMA'; } catch (e) { return false; } };

  // ---------- מסך: אותן חלוניות בדיוק כמו ב-MAIN_PANEL ----------
  function ctHtml(p, ad) {
    var g = function (list, sub) { return list.map(function (f) { return textField(f[1], p + '.' + sub + '.' + f[0], ad[sub][f[0]]); }).join(''); };
    return '\n<div class="subhead" style="font-size:12px;">משנה זרם מדידה</div><div class="grid2">' + g(M, 'measurementCT') + '</div>' +
      '\n<div class="subhead" style="font-size:12px;">משנה זרם הגנה</div><div class="grid2">' + g(P, 'protectionCT') + '</div>' +
      textField('עמידות פסי צבירה בזרם קצר', p + '.protectionCT.busbarWithstand', ad.protectionCT.busbarWithstand, 'text', null, 'לדוגמה: 25kA - FLR, IAC-A, 1s') +
      '\n<div class="subhead" style="font-size:12px;">משנה זרם מסכם</div><div class="grid2">' + g(S, 'summaryCT') + '</div>\n';
  }
  function dropEmptyIp(html, p, ad) {
    if (ad.ipRating) return html;
    var re = new RegExp('<div class="field"><label>דרגת הגנה IP</label>\\s*<input type="text" data-textpath="' + p.replace(/\./g, '\\.') + '\\.ipRating"[^>]*></div>');
    return html.replace(re, '');
  }
  function notesFieldRe(p) {
    return new RegExp('(<div class="field"><label>הערות למסדר</label>\\s*<textarea data-textpath="' + p.replace(/\./g, '\\.') + '\\.notes"[^>]*>[\\s\\S]*?</textarea></div>)');
  }

  var origUnit = renderMainSwitchgearUnit;
  renderMainSwitchgearUnit = function (unit, basePath, idx, totalCount) {
    try { if (unit) unit.assemblyDetails = ensureCT(unit.assemblyDetails || {}); } catch (e) { /* */ }
    var html = origUnit.apply(this, arguments);
    try {
      var p = basePath + '.assemblyDetails', ad = unit.assemblyDetails;
      html = dropEmptyIp(html, p, ad);
      html = html.replace(notesFieldRe(p), function (m) { return m + ctHtml(p, ad); });
    } catch (e) { /* */ }
    return html;
  };

  var origPanel = panelSection;
  panelSection = function (id, idx) {
    var panel = null;
    try { panel = state.panels[id]; if (panel) panel.hvAssemblyDetails = ensureCT(panel.hvAssemblyDetails || {}); } catch (e) { /* */ }
    var html = origPanel.apply(this, arguments);
    try {
      if (panel) {
        var p = 'panels.' + id + '.hvAssemblyDetails', ad = panel.hvAssemblyDetails;
        if (html.indexOf('data-textpath="' + p + '.notes"') < 0) return html; // נתיב שונה — לא נוגעים
        html = dropEmptyIp(html, p, ad);
        html = html.replace(notesFieldRe(p), function (m) { return m + ctHtml(p, ad); });
      }
    } catch (e) { /* */ }
    return html;
  };

  // ברירות מחדל לדוחות חדשים (ודוחות ישנים מקבלים אותן ברינדור הראשון)
  if (typeof makePanel === 'function') {
    var origMakePanel = makePanel;
    makePanel = function () { var pnl = origMakePanel.apply(this, arguments); if (pnl) pnl.hvAssemblyDetails = ensureCT(pnl.hvAssemblyDetails || {}); return pnl; };
  }
  var origNewState = newState;
  newState = function () {
    var s = origNewState.apply(this, arguments);
    try { if (s.mainSwitchgear) s.mainSwitchgear.assemblyDetails = ensureCT(s.mainSwitchgear.assemblyDetails || {}); } catch (e) { /* */ }
    return s;
  };

  // ---------- PDF: אותן טבלאות כמו ב-MAIN_PANEL ----------
  function ctPrint(ad) {
    if (!ad) return '';
    var m = ad.measurementCT || {}, pc = ad.protectionCT || {}, sc = ad.summaryCT || {};
    var rows = function (list, o) { return list.map(function (f) { return [f[1], o[f[0]]]; }).filter(function (r) { return r[1]; }); };
    var mr = rows(M, m), pr = rows(P, pc).concat(pc.busbarWithstand ? [['עמידות פסי צבירה בזרם קצר', pc.busbarWithstand]] : []), sr = rows(S, sc);
    var h = '';
    if (mr.length) h += printCompact2ColTable(mr, 'משנה זרם מדידה');
    if (pr.length) h += printCompact2ColTable(pr, 'משנה זרם הגנה');
    if (sr.length) h += printCompact2ColTable(sr, 'משנה זרם מסכם');
    return h;
  }
  function inject(html, extra, beforeMarker) {
    var i = beforeMarker ? html.indexOf(beforeMarker) : -1;
    return i >= 0 ? html.slice(0, i) + extra + html.slice(i) : html + extra;
  }
  var origBlocks = buildReportBlocks;
  buildReportBlocks = function () {
    var blocks = origBlocks.apply(this, arguments);
    try {
      if (!isSma() || !Array.isArray(blocks)) return blocks;
      var units = [state.mainSwitchgear].concat(state.mainSwitchgearExtra || []);
      units.forEach(function (u, i) {
        var extra = ctPrint(u && u.assemblyDetails); if (!extra) return;
        var b = blocks.find(function (x) { return x && x.sectionKey === 'mainSwitchgear-' + i; });
        if (b) { b.html = inject(b.html, extra, '<h3 style="font-size:13px;">בדיקה ויזואלית — מסדר</h3>'); return; }
        var title = units.length === 1 ? 'מסדר מתח גבוה ראשי' : 'מסדר מתח גבוה — מסדר ' + (i + 1);
        var at = blocks.findIndex(function (x) { return x && /^(panel:|standalone-transformer-|hv-capacitor-|safety|notes|approval)/.test(x.sectionKey || ''); });
        blocks.splice(at < 0 ? blocks.length : at, 0, { level: 1, sectionKey: 'mainSwitchgear-' + i, title: title, html: '<h2>' + title + '</h2>' + extra });
      });
      (state.panelOrder || []).forEach(function (id) {
        var pnl = state.panels[id]; var extra = ctPrint(pnl && pnl.hvAssemblyDetails); if (!extra) return;
        var key = 'panel:' + id;
        var b = blocks.find(function (x) { return x && x.sectionKey === key && x.title === 'פרטי מסדר מתח גבוה'; });
        if (b) { b.html += extra; return; }
        var last = -1; blocks.forEach(function (x, j) { if (x && x.sectionKey === key) last = j; });
        if (last >= 0) { blocks.splice(last + 1, 0, { level: 2, sectionKey: key, title: 'פרטי מסדר מתח גבוה', html: '<h3>פרטי מסדר מתח גבוה</h3>' + extra }); return; }
        // לממיר אין עדיין שום בלוק ב-PDF — יוצרים לו אחד (לפי סדר המסך: לפני בדיקת שנאי / קבל / בטיחות)
        var name = (pnl && pnl.name) || 'ממיר';
        var at = blocks.findIndex(function (x) { return x && /^(standalone-transformer-|hv-capacitor-|safety|notes|protection|approval|general-photos)/.test(x.sectionKey || ''); });
        blocks.splice(at < 0 ? blocks.length : at, 0, { level: 1, sectionKey: key, title: name, html: '<h2>' + escapeHtml(name) + '</h2><h3>פרטי מסדר מתח גבוה</h3>' + extra });
      });
    } catch (e) { /* לא מפילים הפקת PDF */ }
    return blocks;
  };

  try { if (state && state.mainSwitchgear) state.mainSwitchgear.assemblyDetails = ensureCT(state.mainSwitchgear.assemblyDetails || {}); } catch (e) { /* */ }
})();
