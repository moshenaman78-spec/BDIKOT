/*
 * pdf-fixes.js — תיקוני PDF שנמצאו בסימולציה של דוח SMA מלא.
 *  1. כותרת כל ממיר ("ממיר SMA 1 — יצרן: SMA, דגם..., מס' סידורי...") נעלמה מה-PDF: הבלוק שלה מכיל
 *     רק כותרת, ומסנן "סעיף ריק" (hasMeaningfulContent, v2.355) מוחק בלוק שיש בו רק כותרת.
 *     התיקון: הכותרת מוצמדת לתת-הסעיף הראשון של הממיר — כך היא גם לא נשארת לבד בתחתית עמוד.
 *  2. רווחים גדולים / עמודים חצי-ריקים: מנוע מיקום הטבלאות (applyTablePreflight) מדמה מילוי עמודים,
 *     אבל תוכן שאינו טבלה (כרטיס תא מתח גבוה, פסקה, כותרת) רק "נערם" בלי לעבור לעמוד חדש. המנוע
 *     חשב שהעמוד מלא ("נשאר 0") כשבפועל נשאר חצי עמוד — והעביר את הטבלה הבאה לעמוד הבא בלי סיבה.
 *     התיקון: אותה סימולציה, עם מעבר עמוד נכון גם לתוכן שאינו טבלה (גוש שלא נחתך עובר שלם לעמוד
 *     הבא; טקסט רגיל ממשיך לעמוד הבא). חל על כל סוגי הדוחות. מוחל רק אם קוד המנוע תואם בדיוק את
 *     המצופה — אחרת לא נוגעים (המנוע המקורי ממשיך לעבוד).
 *  3. כשטבלה עוברת לעמוד הבא, המנוע העביר איתה רק כותרת אחת. כותרת ממיר + כותרת תת-סעיף —
 *     הראשונה נשארה יתומה בתחתית העמוד. עכשיו כל רצף הכותרות עובר יחד עם הטבלה.
 *  4. שורות אחרונות של עמוד מלא הוסתרו מתחת לפוטר: חלוקת העמודים (estimatePageNumbers + מנוע
 *     הטבלאות) מדדה ברוחב 680px בעוד שרוחב הטקסט בדף בפועל קטן יותר, ובגובה עמוד שלא משאיר מקום
 *     לכותרת ולפוטר. בנוסף, הפוטר "צף" מעל התוכן בכל עמוד (המקום שלו נשמר רק בעמוד האחרון).
 *     התיקון: מדידה ברוחב האמיתי, גובה עמוד אמיתי (פחות כותרת ופוטר), ומקום שמור לפוטר בכל עמוד
 *     (box-decoration-break: clone) — תוכן לעולם לא נכנס מתחת לפוטר.
 *  5. קטע אחד גבוה מעמוד שלם (למשל מסדר עם פרטים + 3 משני זרם + בדיקה ויזואלית + טבלת לוח) נחתך
 *     ע"י הדפדפן באמצע טבלה. עכשיו קטע כזה מפוצל מראש בגבולות טבלה (כותרת נשארת צמודה למה
 *     שאחריה), וכל חלק מתחיל בעמוד משלו עם הכותרת העליונה.
 * נטען אחרון, אחרי שאר קבצי התיקון.
 */
(function () {
  'use strict';
  if (typeof buildReportBlocks !== 'function') return;
  function panelHeading(p) {
    var title = p.name || ('ממיר ' + getInverterBrandLabel());
    var parts = [p.inverterManufacturer ? 'יצרן: ' + escapeHtml(p.inverterManufacturer) : '', p.inverterModel ? 'דגם: ' + escapeHtml(p.inverterModel) : '', p.serial ? "מס' סידורי: " + escapeHtml(p.serial) : ''].filter(Boolean);
    return { title: title, html: '<h2>' + title + (parts.length ? ' — ' + parts.join(', ') : '') + '</h2>' };
  }
  var orig = buildReportBlocks;
  buildReportBlocks = function () {
    var blocks = orig.apply(this, arguments);
    try {
      if (getReportType() !== 'SMA' || !Array.isArray(blocks)) return blocks;
      (state.panelOrder || []).forEach(function (id) {
        var key = 'panel:' + id, p = state.panels[id]; if (!p) return;
        var i = blocks.findIndex(function (b) { return b && b.sectionKey === key; });
        if (i < 0 || blocks[i].level === 1) return; // אין תוכן לממיר, או שהכותרת כבר קיימת
        var h = panelHeading(p);
        blocks[i] = Object.assign({}, blocks[i], { level: 1, title: h.title, html: h.html + blocks[i].html });
      });
    } catch (e) { /* לא מפילים הפקת PDF */ }
    return blocks;
  };

  // ---------- 2. סימולציית עמודים נכונה לתוכן שאינו טבלה ----------
  try {
    var PAGE = TABLE_PREFLIGHT_PAGE_HEIGHT_PX; // מתעדכן לגובה האמיתי בסעיף 4
    window.__shkPfWrap = function (u) { var P = (window.__shkPage && window.__shkPage.pfH) || PAGE; while (u > P) u -= P; return u; };
    window.__shkPfFlow = function (used, h, node) {
      var P = (window.__shkPage && window.__shkPage.pfH) || PAGE;
      if (used + h <= P) return used + h;
      var style = (node && node.getAttribute && node.getAttribute('style')) || '';
      var avoid = !!node && (/^H[1-6]$/.test(node.tagName) || /break-inside\s*:\s*avoid/i.test(style) ||
        (node.classList && ['tinfo-table', 'tinfo-table-2col', 'decl-box', 'electrician-table', 'compact-check-row', 'preflight-2col'].some(function (c) { return node.classList.contains(c); })));
      if (avoid && h <= P) return h;          // גוש שלא נחתך — עובר שלם לעמוד הבא
      return window.__shkPfWrap(used + h);        // טקסט רגיל — ממשיך לעמוד הבא
    };
    var src = applyTablePreflight.toString();
    var re1 = /if\(!isTable\)\{\s*usedHeight \+= nodeHeight;/;
    var re2 = /(if\(decision === 'MOVE_NEXT_PAGE'\)\{\s*usedHeight = finalHeight;\s*\} else \{\s*usedHeight \+= finalHeight;\s*\})/;
    if ((src.match(new RegExp(re1.source, 'g')) || []).length === 1 && (src.match(new RegExp(re2.source, 'g')) || []).length === 1) {
      src = src.replace(re1, 'if(!isTable){\n        usedHeight = window.__shkPfFlow(usedHeight, nodeHeight, node);')
               .replace(re2, '$1\n      usedHeight = window.__shkPfWrap(usedHeight);');
      // 3. כמה כותרות רצופות לפני טבלה (כותרת ממיר + כותרת תת-סעיף) עוברות יחד איתה לעמוד הבא
      var re3 = /const headingHtml2 = prevNode\.outerHTML;/;
      if ((src.match(/const headingHtml2 = prevNode\.outerHTML;/g) || []).length === 1) {
        src = src.replace(re3, 'let __h = idx-1; while(__h-1 >= 0 && /^H[23]$/.test(topLevelNodes[__h-1].tagName)) __h--;\n          const headingHtml2 = topLevelNodes[__h].outerHTML;');
      }
      var patched = (0, eval)('(' + src + ')');
      if (typeof patched === 'function') { applyTablePreflight = patched; window.__shkPreflightPatched = true; }
    }
  } catch (e) { /* המנוע המקורי נשאר */ }

  // ---------- 4. מידות עמוד אמיתיות + מקום לפוטר בכל עמוד ----------
  // ניתנים לכיול (נמדדו מול PDF אמיתי של Chrome, A4, שוליים 12/12/14/12 מ"מ)
  window.__shkPage = window.__shkPage || { width: 651, estH: 845, pfH: 875, footerPad: 60 };
  // מדידה במסמך נקי (iframe מוסתר) — רק CSS ההדפסה חל על מה שנמדד, לא עיצוב המסך של האפליקציה
  window.__shkMD = function () {
    var f = document.getElementById('shkMeasureFrame');
    if (!f) {
      f = document.createElement('iframe'); f.id = 'shkMeasureFrame'; f.setAttribute('aria-hidden', 'true'); f.tabIndex = -1;
      f.style.cssText = 'position:fixed; left:-20000px; top:0; width:1400px; height:3000px; border:0; visibility:hidden; pointer-events:none;';
      document.body.appendChild(f);
      var d0 = f.contentDocument; d0.open(); d0.write('<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"></head><body style="margin:0; background:#fff;"></body></html>'); d0.close();
    }
    return f.contentDocument;
  };
  var useFrame = function (src) { return src.replace(/\bdocument\.(body|head|createElement)\b/g, 'window.__shkMD().$1'); };
  try {
    var est = estimatePageNumbers.toString();
    var r1 = /const pageHeightPx = 975;/, r2 = /const measureWidthPx = 680;/;
    if (r1.test(est) && r2.test(est)) {
      est = useFrame(est.replace(r1, 'const pageHeightPx = window.__shkPage.estH;').replace(r2, 'const measureWidthPx = window.__shkPage.width;'));
      var pe = (0, eval)('(' + est + ')');
      if (typeof pe === 'function') { estimatePageNumbers = pe; window.__shkEstimatePatched = true; }
    }
  } catch (e) { /* */ }
  try {
    if (window.__shkPreflightPatched) {
      var pf = applyTablePreflight.toString()
        .replace(/TABLE_PREFLIGHT_PAGE_HEIGHT_PX/g, 'window.__shkPage.pfH')
        .replace(/TABLE_PREFLIGHT_WIDTH_PX/g, 'window.__shkPage.width');
      pf = useFrame(pf);
      var pp = (0, eval)('(' + pf + ')');
      if (typeof pp === 'function') { applyTablePreflight = pp; PAGE = window.__shkPage.pfH; }
    }
  } catch (e) { /* */ }
  if (window.__shkEstimatePatched && typeof buildStandaloneDoc === 'function') {
    var origDoc = buildStandaloneDoc;
    buildStandaloneDoc = function () {
      var html = origDoc.apply(this, arguments);
      var css = '<style id="shkPrintFix">@media print{.sheet{padding-top:0 !important; padding-bottom:' + window.__shkPage.footerPad + 'px !important; -webkit-box-decoration-break:clone; box-decoration-break:clone;} .sheet table{break-inside:avoid; page-break-inside:avoid;}}</style>';
      return typeof html === 'string' && html.indexOf('</head>') > 0 ? html.replace('</head>', css + '</head>') : html;
    };
  }

  // ---------- 5. פיצול קטע שגבוה מעמוד, בגבולות טבלה ----------
  function measureBlocks(htmls) {
    var d = window.__shkMD(); var st = d.createElement('style'); st.textContent = extractPrintCss(); d.head.appendChild(st);
    var c = d.createElement('div'); c.className = 'sheet toc-measure';
    c.style.cssText = 'position:fixed; top:0; left:-99999px; width:' + window.__shkPage.width + 'px; padding:0; margin:0; direction:rtl; font-family:Arial, Tahoma, sans-serif;';
    d.body.appendChild(c);
    var out = htmls.map(function (h) { c.innerHTML = h; return c.offsetHeight || 0; });
    d.body.removeChild(c); d.head.removeChild(st);
    return { out: out, doc: d };
  }
  function splitOversize(blocks) {
    var H = window.__shkPage.estH;
    var heights = measureBlocks(blocks.map(function (b) { return b.html; })).out;
    var res = [];
    blocks.forEach(function (b, i) {
      if (heights[i] <= H) { res.push(b); return; }
      var d = window.__shkMD(); var tmp = d.createElement('div'); tmp.innerHTML = b.html;
      var nodes = Array.prototype.slice.call(tmp.children);
      if (nodes.length < 2) { res.push(b); return; }
      // יחידות: כותרת(ות) + האלמנט שאחריהן = יחידה אחת שלא מפרידים
      var units = [], cur = '';
      nodes.forEach(function (n) { cur += n.outerHTML; if (!/^H[1-6]$/.test(n.tagName)) { units.push(cur); cur = ''; } });
      if (cur) { if (units.length) units[units.length - 1] += cur; else units.push(cur); }
      var uh = measureBlocks(units).out;
      var chunks = [], ch = '', chH = 0;
      units.forEach(function (u, j) {
        if (ch && chH + uh[j] > H) { chunks.push(ch); ch = ''; chH = 0; }
        ch += u; chH += uh[j];
      });
      if (ch) chunks.push(ch);
      chunks.forEach(function (html, k) { res.push(Object.assign({}, b, { html: html, pageBreak: k === 0 ? !!b.pageBreak : true })); });
    });
    blocks.length = 0; res.forEach(function (b) { blocks.push(b); });
  }
  if (window.__shkEstimatePatched && typeof applyTablePreflight === 'function') {
    var pfInner = applyTablePreflight;
    applyTablePreflight = function (blocks) {
      var log = pfInner.apply(this, arguments);
      try { splitOversize(blocks); } catch (e) { /* */ }
      return log;
    };
  }
})();
