/*
 * report-number.js — אפשרות לשנות את מספר הדוח גם אחרי שהדוח כבר נוצר בענן.
 * עד עכשיו המספר ננעל אחרי היצירה ("קבוע — הדוח קיים בענן"). עכשיו יש כפתור "✏️ שנה מספר":
 *   1. שומר קודם כל שינוי שעוד לא הגיע לענן (כדי לא לדרוס כלום).
 *   2. בודק שהמספר החדש לא תפוס בדוח אחר.
 *   3. מעדכן את report_number באותה רשומה בדיוק (אותו UUID), בעדכון מותנה בגרסה — אם הדוח
 *      השתנה במכשיר אחר בינתיים, לא משנים כלום ומבקשים לרענן.
 * נטען אחרי app.js; לא משנה את app.js.
 */
(function () {
  'use strict';
  if (typeof renderInner !== 'function' || typeof saveReportToCloud !== 'function') return;
  var busy = false;

  async function changeNumber() {
    if (busy) return;
    var s = state.settings, id = s.cloudReportId;
    var cur = state.meta.reportNumber || '';
    var next = window.prompt('מספר דוח חדש (המספר הנוכחי: ' + (cur || '—') + '):', cur);
    if (next == null) return;
    next = String(next).trim();
    if (!next || next === cur) return;
    if (navigator.onLine === false || !supabaseClient || !cloudCurrentUser) { showToast('אין חיבור לענן — אי אפשר לשנות מספר דוח כרגע'); return; }
    busy = true;
    try {
      var saved = await saveReportToCloud(); // קודם מעלים כל עריכה שעוד לא בענן
      if (saved === 'conflict') { showToast('הדוח עודכן ממכשיר אחר — פתח את הגרסה העדכנית ונסה שוב'); return; }
      if (saved !== true && saved !== 'empty') { showToast('לא ניתן לשמור לענן כרגע — המספר לא שונה'); return; }
      var clash = await supabaseClient.from('reports').select('id').eq('report_number', next).neq('id', id).limit(1);
      if (clash.error) throw clash.error;
      if (clash.data && clash.data.length) { showToast('המספר "' + next + '" כבר קיים בדוח אחר — בחר מספר אחר'); return; }
      var known = s.cloudKnownUpdatedAt;
      var q = supabaseClient.from('reports').update({ report_number: next }).eq('id', id);
      if (known) q = q.eq('updated_at', known);
      var res = await q.select('id, updated_at');
      if (res.error) {
        if (String(res.error.code) === '23505') { showToast('המספר "' + next + '" כבר קיים בדוח אחר — בחר מספר אחר'); return; }
        throw res.error;
      }
      if (!res.data || !res.data.length) { showToast('הדוח עודכן ממכשיר אחר בינתיים — המספר לא שונה. פתח את הגרסה העדכנית ונסה שוב'); return; }
      setKnownCloudVersion(res.data[0].updated_at);
      state.meta.reportNumber = next;
      scheduleSave(); // מעדכן גם את report_data (עמוד השער / PDF) באותה רשומה
      render();
      showToast('מספר הדוח שונה ל-' + next);
    } catch (e) {
      showToast('שינוי מספר הדוח נכשל: ' + ((e && e.message) || e));
    } finally { busy = false; }
  }
  try { window.shkChangeReportNumber = changeNumber; } catch (e) { /* */ }

  function decorate() {
    var inputs = document.querySelectorAll('#app .field input[readonly]');
    inputs.forEach(function (inp) {
      var field = inp.closest('.field'); if (!field || field.querySelector('.shk-rn-btn')) return;
      var lbl = field.querySelector('label');
      if (!lbl || lbl.textContent.indexOf('מספר דו"ח (קבוע') !== 0) return;
      lbl.textContent = 'מספר דו"ח';
      var row = document.createElement('div'); row.style.cssText = 'display:flex; gap:6px; align-items:center;';
      inp.parentNode.insertBefore(row, inp); row.appendChild(inp); inp.style.flex = '1';
      var b = document.createElement('button'); b.type = 'button'; b.className = 'today-btn shk-rn-btn'; b.textContent = '✏️ שנה מספר';
      b.style.cssText = 'flex-shrink:0; min-height:44px; padding:6px 12px;';
      b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); changeNumber(); });
      row.appendChild(b);
    });
  }
  var orig = renderInner;
  renderInner = function () { var r = orig.apply(this, arguments); try { decorate(); } catch (e) { /* */ } return r; };
  try { decorate(); } catch (e) { /* */ }
})();
