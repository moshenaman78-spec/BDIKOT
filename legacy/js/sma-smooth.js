/*
 * sma-smooth.js — דוח "טיפול בממירי SMA": עבודה חלקה יותר בטלפון/טאבלט.
 * שורת בדיקה (תקין / לא תקין / לא רל' + תמונה + הערה) תופסת שתי שורות במקום שלוש:
 * כפתורי התמונה וההערה עוברים לאותה שורה עם כפתורי הסטטוס, כאייקון בלבד.
 * כרטיס ממיר ירד מכ-15,000px גלילה לכ-10,000px. CSS ותצוגה בלבד — אין שינוי בנתונים.
 */
(function () {
  'use strict';
  if (typeof renderInner !== 'function') return;
  var css = '@media (max-width:999px){' +
    'body.shk-sma-compact #app .item-row{gap:6px; padding:8px; align-items:center;}' +
    'body.shk-sma-compact #app .item-row .lbl{flex:1 1 100%; font-size:14.5px; line-height:1.35;}' +
    'body.shk-sma-compact #app .item-row .status-group{flex:1 1 0; min-width:0; display:flex; gap:4px;}' +
    'body.shk-sma-compact #app .item-row .status-btn{flex:1 1 0; min-width:0; min-height:44px; padding:4px 2px; font-size:14px;}' +
    'body.shk-sma-compact #app .item-row .item-photo-btn{flex:0 0 44px; width:44px; min-width:44px; min-height:44px; padding:0; font-size:17px; white-space:nowrap;}' +
    'body.shk-sma-compact #app .item-row .item-photo-btn.shk-count{flex-basis:54px; width:54px; font-size:14px;}' +
    '}';
  var st = document.createElement('style'); st.id = 'shkSmaSmooth'; st.textContent = css; document.head.appendChild(st);

  function isSma() { try { return getReportType() === 'SMA'; } catch (e) { return false; } }
  function compact() {
    var on = isSma() && activeTab === 'inspection';
    document.body.classList.toggle('shk-sma-compact', on);
    if (!on) return;
    document.querySelectorAll('#app .item-row .item-photo-btn[data-itemgallerybtn]').forEach(function (b) {
      var m = b.textContent.match(/(\d+)\s*$/);
      b.textContent = '📷' + (m ? ' ' + m[1] : '');
      b.classList.toggle('shk-count', !!m);
      b.setAttribute('aria-label', 'הוסף תמונה' + (m ? ' (' + m[1] + ')' : ''));
    });
  }
  var orig = renderInner;
  renderInner = function () { var r = orig.apply(this, arguments); try { compact(); } catch (e) { /* */ } return r; };
  try { compact(); } catch (e) { /* */ }
})();
