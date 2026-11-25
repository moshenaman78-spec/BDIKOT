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
      // splitOversize הוחלף ב-fillPages (סעיף 6), שמטפל גם בקטע גבוה מעמוד
      return log;
    };
  }

  // ---------- 6. מילוי שארית העמוד בין טבלאות שלמות ----------
  var NO_FILL = ['hc-summary', 'sp-stor-table', 'sp-ac-table', 'general-photos', 'inspector-license', 'soil-signature', 'dc-signatures', 'flex-signature'];
  function unitsOf(html) {
    var d = window.__shkMD(); var tmp = d.createElement('div'); tmp.innerHTML = html;
    var nodes = Array.prototype.slice.call(tmp.children), units = [], cur = '';
    nodes.forEach(function (n) {
      // פסקת הערה (P) קצרה אחרי טבלה נשארת צמודה אליה
      if (n.tagName === 'P' && !cur && units.length && (n.textContent || '').length < 400) { units[units.length - 1] += n.outerHTML; return; }
      cur += n.outerHTML; if (!/^H[1-6]$/.test(n.tagName) && !n.classList.contains('page-logo-header')) { units.push(cur); cur = ''; }
    });
    if (cur) { if (units.length) units[units.length - 1] += cur; else units.push(cur); }
    // יחידה אחרונה בלי טקסט (חתימה/חותמת) נשארת צמודה ליחידה שלפניה
    if (units.length > 1) { var lt = d.createElement('div'); lt.innerHTML = units[units.length - 1]; if ((lt.textContent || '').trim().length < 5) { var lastU = units.pop(); units[units.length - 1] += lastU; } }
    return units;
  }
  // זוג טבלאות זו-לצד-זו שלא נכנס בשארית העמוד — מוצג אחת מתחת לשנייה (כל אחת יחידה נפרדת)
  function unpair(unitHtml) {
    var d = window.__shkMD(); var tmp = d.createElement('div'); tmp.innerHTML = unitHtml;
    var kids = Array.prototype.slice.call(tmp.children), pair = kids.filter(function (k) { return k.classList && k.classList.contains('preflight-2col'); })[0];
    if (!pair) return null;
    var before = '', after = '', seen = false;
    kids.forEach(function (k) { if (k === pair) { seen = true; return; } if (!seen) before += k.outerHTML; else after += k.outerHTML; });
    var cols = Array.prototype.slice.call(pair.children).map(function (c) { return c.innerHTML; }).filter(Boolean);
    if (cols.length < 2) return null;
    cols[0] = before + cols[0]; cols[cols.length - 1] += after;
    return cols;
  }
  // מבטל מעברי עמוד שמנוע הטבלאות הישן הוסיף לפי הערכה לא מדויקת (אותו סעיף שפוצל) — החלוקה נקבעת כאן
  function mergeEngineBreaks(blocks) {
    var out = [];
    blocks.forEach(function (b) {
      var prev = out[out.length - 1];
      if (prev && b.pageBreak && prev.sectionKey === b.sectionKey && prev.title === b.title && prev.level === b.level &&
          !NO_FILL.some(function (k) { return (b.sectionKey || '').indexOf(k) === 0; })) {
        out[out.length - 1] = Object.assign({}, prev, { html: prev.html + b.html });
      } else out.push(b);
    });
    return out;
  }
  // מחזיר לכל סעיף את מעבר העמוד המקורי שלו, ומאחד חלקים שמנוע הטבלאות הישן פיצל (לפי הערכה לא מדויקת)
  function restoreBreaks(blocks, orig) {
    var out = [], oi = -1;
    blocks.forEach(function (b) {
      var k = b.sectionKey + '|' + b.title + '|' + b.level;
      var land = NO_FILL.slice(0, 3).indexOf(b.sectionKey) >= 0;
      if (oi >= 0 && orig[oi].k === k && out.length && !land) {   // המשך של אותו סעיף מקורי
        var prev = out[out.length - 1];
        out[out.length - 1] = Object.assign({}, prev, { html: prev.html + b.html });
        return;
      }
      var j = oi + 1; while (j < orig.length && orig[j].k !== k) j++;
      if (j < orig.length) oi = j;
      out.push(land ? b : Object.assign({}, b, { pageBreak: j < orig.length ? orig[j].pb : !!b.pageBreak }));
    });
    blocks.length = 0; out.forEach(function (x) { blocks.push(x); });
  }
  // טבלה ארוכה (8+ שורות, עם שורת כותרות) ממשיכה לעמוד הבא בשורות שלמות; לפחות 4 שורות בכל צד; כותרות העמודות חוזרות
  var MIN_ROWS = 3, MIN_TABLE_ROWS = 6;
  function trySplitTable(unitHtml, room) {
    var d = window.__shkMD(); var tmp = d.createElement('div'); tmp.innerHTML = unitHtml;
    var kids = Array.prototype.slice.call(tmp.children);
    var tail = []; while (kids.length && kids[kids.length - 1].tagName === 'P') tail.unshift(kids.pop()); // הערות אחרי הטבלה — עם החלק השני
    var t = kids[kids.length - 1];
    if (!t || t.tagName !== 'TABLE' || !t.tBodies.length || t.tBodies.length > 1) return null;
    var heads = kids.slice(0, -1);
    if (heads.some(function (h) { return !/^H[1-6]$/.test(h.tagName); })) return null;
    var rows = Array.prototype.slice.call(t.tBodies[0].rows);
    // טבלה בלי thead: שורת כותרת (תא שמתפרס על כל הרוחב) נחשבת כותרת וחוזרת בהמשך
    var thead = t.tHead ? t.tHead.outerHTML : '';
    if (!thead && rows.length && rows[0].cells.length === 1 && rows[0].cells[0].colSpan > 1) thead = '<thead>' + rows.shift().outerHTML + '</thead>';
    if (rows.length < MIN_TABLE_ROWS) return null;
    var open = t.outerHTML.slice(0, t.outerHTML.indexOf('>') + 1);
    var tb = t.tBodies[0], tbOpen = tb.outerHTML.slice(0, tb.outerHTML.indexOf('>') + 1);
    var mk = function (from, to, withHeads) {
      return (withHeads ? heads.map(function (h) { return h.outerHTML; }).join('') : '') + open + thead + tbOpen +
        rows.slice(from, to).map(function (r) { return r.outerHTML; }).join('') + '</tbody></table>';
    };
    var best = 0;
    for (var k = rows.length - MIN_ROWS; k >= MIN_ROWS; k--) {
      if (measureBlocks([mk(0, k, true)]).out[0] <= room) { best = k; break; }
    }
    if (!best) return null;
    var last = heads.length ? heads[heads.length - 1] : null;
    var contHead = last ? '<' + last.tagName.toLowerCase() + '>' + last.textContent.trim() + ' (המשך)</' + last.tagName.toLowerCase() + '>' : '';
    return [mk(0, best, true), contHead + mk(best, rows.length, false) + tail.map(function (x) { return x.outerHTML; }).join('')];
  }
  function fillPages(blocks) {
    var H = window.__shkPage.estH, SAFE = 10, res = [], used = Infinity, queue = blocks.slice(), guard = 0;
    while (queue.length && guard++ < 2000) {
      var b = queue.shift();
      var h = measureBlocks([b.html]).out[0];
      if (b.pageBreak || used === Infinity) used = 0;
      if (NO_FILL.some(function (k) { return (b.sectionKey || '').indexOf(k) === 0; })) {
        if (used + h > H) used = 0;
        res.push(b); used += h; if (used > H) used = used % H; continue;
      }
      if (used + h <= H) { res.push(b); used += h; continue; }
      var room = H - used - SAFE, units = unitsOf(b.html);
      if (units.length === 1) { var up1 = unpair(units[0]); if (up1) units = up1; else { var sp1 = trySplitTable(units[0], room); if (sp1) units = sp1; } }
      if (units.length > 1) {
        var uh = measureBlocks(units).out, take = 0, acc = 0;
        while (take < units.length - 1 && acc + uh[take] <= room) { acc += uh[take]; take++; }
        var up = take < units.length ? unpair(units[take]) : null;
        if (up) {
          units = units.slice(0, take).concat(up, units.slice(take + 1)); uh = measureBlocks(units).out;
          while (take < units.length - 1 && acc + uh[take] <= room) { acc += uh[take]; take++; }
        }
        var sp = take < units.length ? trySplitTable(units[take], room - acc) : null;
        if (sp) { units = units.slice(0, take).concat(sp, units.slice(take + 1)); take++; }
        if (take > 0) {
          res.push(Object.assign({}, b, { html: units.slice(0, take).join('') }));
          queue.unshift(Object.assign({}, b, { html: units.slice(take).join(''), pageBreak: true, __cont: true }));
          used = H; continue;
        }
      }
      if (used === 0) { res.push(b); used = h % H; continue; }  // יחידה אחת גבוהה מעמוד — כמו שהיא
      queue.unshift(Object.assign({}, b, { pageBreak: true }));  // עוברת שלמה לעמוד חדש
    }
    blocks.length = 0; res.forEach(function (x) { blocks.push(x); });
  }
  if (window.__shkEstimatePatched && typeof applyTablePreflight === 'function') {
    var pfInner2 = applyTablePreflight;
    applyTablePreflight = function (blocks) {
      var orig = (blocks || []).map(function (b) { return { k: b.sectionKey + '|' + b.title + '|' + b.level, pb: !!b.pageBreak }; });
      var log = pfInner2.apply(this, arguments);
      try { restoreBreaks(blocks, orig); fillPages(blocks); } catch (e) { /* */ }
      return log;
    };
  }
  // תוכן עניינים: המשך של סעיף לא מופיע כשורה נוספת
  if (typeof buildTocTable === 'function') {
    var origToc = buildTocTable;
    buildTocTable = function (blocks, pages, totalPages) {
      var b2 = [], p2 = [];
      (blocks || []).forEach(function (b, i) { if (b && b.__cont) return; b2.push(b); p2.push(pages[i]); });
      return origToc.call(this, b2, p2, totalPages);
    };
  }
})();
