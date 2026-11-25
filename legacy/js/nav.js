/* Shaked Test Reports — שכבת ממשק (redesign) v2
   1. תפריט "ניווט מהיר" צדדי שנבנה אוטומטית מהכרטיסים של כל סוג דוח
   2. "סמן את השאר תקין" לכל צ'קליסט (ממלא רק פריטים שעוד לא נבדקו)
   3. חלקים אופציונליים בממיר (AUX / מכולת אגירה / שנאי בית) — מפעילים בתיבת סימון
   4. מתג מצב בהיר/כהה (נשמר במכשיר)
   5. מחוון שמירה עם "לפני X"
   עובד מעל ה-DOM ומשתמש בפונקציות הקיימות של app.js (state, setDeep, scheduleSave, render, showToast). */
(function(){
  'use strict';
  var app, nav, timer = null, lastSig = '', enhancing = false;

  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function G(name){ try{ return (0, eval)(name); }catch(e){ return undefined; } }
  function toast(msg){ var f = G('showToast'); if(typeof f === 'function') f(msg); }

  function headerOffset(){
    var h = document.querySelector('header.top');
    var top = h ? Math.max(0, Math.round(h.getBoundingClientRect().bottom)) : 0;
    document.documentElement.style.setProperty('--rd-top', top + 'px');
    return top;
  }

  /* ---------------- 1. ניווט מהיר ---------------- */
  function cardInfo(card, idx){
    var head = card.querySelector(':scope > .card-head');
    var h2 = head && head.querySelector('h2');
    if(!h2) return null;
    var numEl = h2.querySelector('.num');
    var num = numEl ? numEl.textContent.trim() : '';
    var bdiEl = h2.querySelector('bdi');
    var extra = bdiEl ? bdiEl.textContent.trim() : '';
    // בתפריט הצר: שם קצר (INV-1 במקום "INV-1 (SMA Sunny Tripower 110)") כדי שלא ייחתך באמצע
    if(extra.length > 14 && extra.indexOf(' (') > 0) extra = extra.slice(0, extra.indexOf(' ('));
    var name = (bdiEl ? h2.textContent.replace(bdiEl.textContent, '') : h2.textContent).replace(num, '').replace(/\s+/g, ' ').trim();
    if(!num){ var m = name.match(/^(\d{1,2})\s+(.*)$/); if(m){ num = m[1]; name = m[2]; } }
    if(!name) return null;
    var groups = Array.prototype.filter.call(card.querySelectorAll('.status-group, select.sp-status-sel'), function(g){ return !g.closest('.rd-opt-hidden') && !g.closest('.sp-gen'); });
    var answered = 0;
    groups.forEach(function(g){ if(g.tagName === 'SELECT' ? !!g.value : g.querySelector('.status-btn.active')) answered++; });
    return {
      key: card.getAttribute('data-key') || ('idx' + idx),
      num: num || '•', name: name, extra: extra, total: groups.length, answered: answered,
      repeat: !!head.querySelector('.del-panel-btn') || /^panel-/.test(card.getAttribute('data-key') || '')
    };
  }
  function visibleCards(){
    return Array.prototype.filter.call(app.querySelectorAll('section.card'), function(c){
      return c.offsetParent !== null && !c.closest('.preview-modal');
    });
  }
  function build(){
    timer = null;
    if(!app || !nav) return;
    headerOffset();
    var items = visibleCards().map(cardInfo).filter(Boolean);
    if(items.length < 3){ document.body.classList.remove('rd-has-nav'); nav.innerHTML = ''; lastSig = ''; return; }
    document.body.classList.add('rd-has-nav');
    var sig = JSON.stringify(items);
    if(sig === lastSig){ markActive(); return; }
    lastSig = sig;
    var html = '<button type="button" class="rd-nav-toggle" data-rdtoggle="1" aria-label="צמצם / הרחב את תפריט הניווט"><span class="rd-tg-open">צמצם תפריט ▸</span><span class="rd-tg-closed">◂</span></button>' +
      '<div class="rd-nav-title">ניווט מהיר</div>';
    items.forEach(function(it){
      var done = it.total > 0 && it.answered === it.total;
      var pct = it.total ? Math.round(it.answered / it.total * 100) : 0;
      html += '<button type="button" data-rdkey="' + esc(it.key) + '" title="' + esc(it.name + (it.extra ? ' ' + it.extra : '')) + (it.total ? ' — ' + it.answered + '/' + it.total : '') + '" class="' + (done ? 'rd-done ' : '') + (it.repeat ? 'rd-rep' : '') + '">' +
        '<span class="rd-num">' + (done ? '✓' : esc(it.num)) + '</span>' +
        '<span class="rd-body"><span class="rd-name">' + esc(it.name) + (it.extra ? ' <bdi dir="' + (/^[^A-Za-z\u0590-\u05FF]*[A-Za-z]/.test(it.extra) ? 'ltr' : 'rtl') + '">' + esc(it.extra) + '</bdi>' : '') + '</span>' +
        (it.total ? '<span class="rd-meta"><span class="rd-bar"><i style="width:' + pct + '%"></i></span><span class="rd-count">' + it.answered + '/' + it.total + '</span></span>' : '') +
        '</span></button>';
    });
    nav.innerHTML = html;
    markActive();
  }
  function findCard(key){
    var list = visibleCards();
    for(var i = 0; i < list.length; i++){ if((list[i].getAttribute('data-key') || ('idx' + i)) === key) return list[i]; }
    return null;
  }
  function go(key){
    var card = findCard(key);
    if(!card) return;
    if(!card.classList.contains('open')){ var head = card.querySelector(':scope > .card-head'); if(head) head.click(); }
    setTimeout(function(){
      var c = findCard(key); if(!c) return;
      var y = c.getBoundingClientRect().top + window.pageYOffset - headerOffset() - 12;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }, 60);
  }
  function markActive(){
    if(!nav || !nav.firstChild) return;
    var top = headerOffset() + 20, best = null;
    visibleCards().forEach(function(c, i){
      if(c.getBoundingClientRect().top <= Math.max(top + 40, window.innerHeight * 0.3)) best = c.getAttribute('data-key') || ('idx' + i);
    });
    nav.querySelectorAll('button[data-rdkey]').forEach(function(b){ b.classList.toggle('rd-active', b.getAttribute('data-rdkey') === best); });
  }

  /* ---------------- 2. סמן את השאר תקין ---------------- */
  function isRowSibling(el){ return el && (el.classList.contains('item-row') || el.classList.contains('item-photo-thumbs') || el.classList.contains('item-note-box')); }
  function enhanceBulk(){
    var rows = app.querySelectorAll('.item-row');
    rows.forEach(function(row){
      if(!row.querySelector('.status-group .status-btn[data-path]')) return;
      var prev = row.previousElementSibling;
      while(prev && (prev.classList.contains('item-photo-thumbs') || prev.classList.contains('item-note-box'))) prev = prev.previousElementSibling;
      if(prev && prev.classList.contains('item-row')) return;           // לא תחילת קבוצה
      if(prev && prev.classList.contains('rd-bulk')) return;             // כבר נוסף
      var group = [], el = row;
      while(isRowSibling(el)){ if(el.classList.contains('item-row')) group.push(el); el = el.nextElementSibling; }
      var pending = group.filter(function(r){ return r.querySelector('.status-btn[data-path]') && !r.querySelector('.status-btn.active'); });
      if(group.length < 2 || !pending.length) return;
      var bar = document.createElement('div');
      bar.className = 'rd-bulk';
      bar.innerHTML = '<button type="button">✓ סמן את השאר תקין</button><span>' + pending.length + ' מתוך ' + group.length + ' עוד לא נבדקו</span>';
      bar.querySelector('button').addEventListener('click', function(e){
        e.stopPropagation();
        var st = G('state'), setDeep = G('setDeep');
        if(!st || typeof setDeep !== 'function') return;
        var n = 0;
        pending.forEach(function(r){
          var ok = r.querySelector('.status-btn.ok[data-path]');
          if(!ok) return;
          setDeep(st, ok.getAttribute('data-path') + '.' + ok.getAttribute('data-idx'), 'ok'); n++;
        });
        G('scheduleSave')(); G('render')();
        toast(n + ' פריטים סומנו תקין');
      });
      row.parentNode.insertBefore(bar, row);
    });
  }

  /* ---------------- 3. חלקים אופציונליים בממיר ---------------- */
  function filled(v){ return v !== undefined && v !== null && String(v).trim() !== ''; }
  var OPTIONAL = {
    'הזנה ללוח AUX': function(p){ var a = p.auxFeed || {}; return ['spec','torque','cleaning','notes'].some(function(k){ return filled(a[k]); }); },
    'הזנה למכולת אגירה': function(p){ return (p.storageContainers || []).some(function(c){ return ['torque','cleaning','notes'].some(function(k){ return filled(c[k]); }); }); },
    'שנאי בית — כבלים': function(p){ var h = p.houseTransformer || {}; return Object.keys(h).some(function(k){ return !/Unit$/.test(k) && filled(h[k]); }); },
    'בדיקת בידוד — שנאי בית': function(p){ var t = p.insulationHouse || {}; return (t.rows || []).some(function(r){ return filled(r.r15) || filled(r.r60) || filled(r.note) || filled(r.manualClassification); }); }
  };
  function sectionEls(sh){
    var out = [], el = sh.nextElementSibling;
    while(el && !el.classList.contains('subhead')){ out.push(el); el = el.nextElementSibling; }
    return out;
  }
  function enhanceOptional(){
    var st = G('state');
    if(!st || !st.panels) return;
    app.querySelectorAll('section.card[data-key^="panel-"] .subhead').forEach(function(sh){
      if(sh.querySelector('.rd-opt')) return;
      var label = sh.textContent.trim();
      if(!OPTIONAL[label]) return;
      var id = sh.closest('section.card').getAttribute('data-key').replace(/^panel-/, '');
      var panel = st.panels[id];
      if(!panel) return;
      var hasData = OPTIONAL[label](panel);
      var saved = panel.rdOptional && Object.prototype.hasOwnProperty.call(panel.rdOptional, label) ? panel.rdOptional[label] : undefined;
      var on = saved === undefined ? hasData : !!saved;
      sh.textContent = '';
      var lab = document.createElement('label');
      lab.className = 'rd-opt';
      lab.innerHTML = '<input type="checkbox"' + (on ? ' checked' : '') + '><span>' + esc(label) + '</span><span class="rd-opt-state">' + (on ? 'מופעל' : 'לא מופעל') + '</span>';
      sh.appendChild(lab);
      sh.classList.add(on ? 'rd-opt-on' : 'rd-opt-off');
      sectionEls(sh).forEach(function(el){ el.classList.toggle('rd-opt-hidden', !on); });
      var cb = lab.querySelector('input');
      cb.addEventListener('click', function(e){ e.stopPropagation(); });
      cb.addEventListener('change', function(){
        var want = cb.checked;
        var apply = function(){
          panel.rdOptional = panel.rdOptional || {};
          panel.rdOptional[label] = want;
          G('scheduleSave')(); G('render')();
        };
        if(!want && hasData){
          var msg = 'בחלק "' + label + '" כבר יש נתונים. הם יישארו שמורים ויופיעו בדוח. להסתיר את החלק מהטופס?';
          var confirmFn = G('showAppConfirm');
          if(typeof confirmFn === 'function'){ confirmFn(msg).then(function(ok){ if(ok) apply(); else cb.checked = true; }); }
          else if(window.confirm(msg)) apply(); else cb.checked = true;
        } else apply();
      });
    });
  }

  /* ---------------- דוח קוטביות: הדגשת בידוד נמוך, רשימת תבניות, מונה חריגים ---------------- */
  function enhanceStringPolarity(){
    var st = G('state'); if(!st || !st.stringPolarityReport || G('getReportType')() !== 'STRING_POLARITY') return;
    var low = G('spIsLow'), getDeep = G('getDeep');
    app.querySelectorAll('input[data-textpath^="stringPolarityReport."]').forEach(function(inp){
      var p = inp.getAttribute('data-textpath');
      var m = p.match(/^(.*)\.(insulation|insPlus|insMinus|l1e|l2e|l3e|l1l2|l2l3|l3l1|l1n|l2n|l3n)$/);
      if(!m) return;
      var row = getDeep(st, m[1]); if(!row) return;
      var unit = m[2] === 'insulation' ? row.insulationUnit : (m[2] === 'insPlus' ? row.insPlusUnit : (m[2] === 'insMinus' ? row.insMinusUnit : row.unit));
      var isLow = low(inp.value, unit);
      if(inp.classList.contains('sp-low') !== isLow) inp.classList.toggle('sp-low', isLow);
    });
    // מחולל השורות נשאר פתוח גם אחרי רינדור (בחירה בחלונית גורמת לרינדור מחדש)
    app.querySelectorAll('details.sp-gen').forEach(function(d){
      var k = (d.closest('section.card') || {}).getAttribute ? d.closest('section.card').getAttribute('data-key') : '';
      if(window.__rdGenOpen && window.__rdGenOpen[k] && !d.open) d.open = true;
    });
    if(window.__rdFillTplSelect) window.__rdFillTplSelect();
    var cnt = document.getElementById('spExcCount');
    if(cnt && window.__rdCollectExceptions){
      var n = window.__rdCollectExceptions(st.stringPolarityReport).length;
      var t = n ? ('נמצאו ' + n + ' חריגים') : 'אין חריגים';
      if(cnt.textContent !== t){ cnt.textContent = t; cnt.classList.toggle('has', n > 0); }
    }
  }

  /* ---------------- טופס PV — חתימת החשמלאי (canvas) ---------------- */
  function enhancePvSignature(){
    var c = app.querySelector('canvas.pv-sig'); if(!c || c.__rdInit) return;
    c.__rdInit = true;
    var ctx = c.getContext('2d'); ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.strokeStyle = '#1c2530';
    var pv = G('getPvInspection')(), drawing = false, lx = 0, ly = 0;
    if(pv.decl && pv.decl.signature){ var im = new Image(); im.onload = function(){ ctx.drawImage(im, 0, 0, c.width, c.height); }; im.src = pv.decl.signature; }
    var pos = function(e){ var r = c.getBoundingClientRect(); return { x: (e.clientX - r.left) * c.width / r.width, y: (e.clientY - r.top) * c.height / r.height }; };
    c.addEventListener('pointerdown', function(e){ e.preventDefault(); drawing = true; c.setPointerCapture(e.pointerId); var p = pos(e); lx = p.x; ly = p.y; });
    c.addEventListener('pointermove', function(e){ if(!drawing) return; e.preventDefault(); var p = pos(e); ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(p.x, p.y); ctx.stroke(); lx = p.x; ly = p.y; });
    var end = function(){ if(!drawing) return; drawing = false; G('getPvInspection')().decl.signature = c.toDataURL('image/png'); G('scheduleSave')(); };
    c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end);
    var btn = app.querySelector('[data-pvsigclear]');
    if(btn) btn.addEventListener('click', function(e){ e.stopPropagation(); ctx.clearRect(0, 0, c.width, c.height); G('getPvInspection')().decl.signature = ''; G('scheduleSave')(); });
  }

  /* ---------------- 4. מתג בהיר/כהה ---------------- */
  function initTheme(){
    var row = document.querySelector('header.top .row1');
    var link = document.getElementById('rdLightCss');
    if(!row || !link || document.getElementById('rdThemeBtn')) return;
    var btn = document.createElement('button');
    btn.type = 'button'; btn.id = 'rdThemeBtn';
    var label = function(){ btn.innerHTML = link.disabled ? '<span>☀️</span><span class="rd-tx"> מצב בהיר</span>' : '<span>🌙</span><span class="rd-tx"> מצב כהה</span>'; btn.setAttribute('aria-label', link.disabled ? 'מעבר למצב בהיר' : 'מעבר למצב כהה'); };
    label();
    btn.addEventListener('click', function(){
      link.disabled = !link.disabled;
      try{ localStorage.setItem('rdTheme', link.disabled ? 'dark' : 'light'); }catch(e){}
      label(); lastSig = ''; schedule();
    });
    row.appendChild(btn);
  }

  /* ---------------- 5. מחוון שמירה ---------------- */
  var lastSavedAt = 0, lastPillText = '';
  function agoText(){
    var s = Math.round((Date.now() - lastSavedAt) / 1000);
    if(s < 20) return 'עכשיו';
    if(s < 60) return 'לפני ' + s + ' שניות';
    var m = Math.round(s / 60);
    return m === 1 ? 'לפני דקה' : 'לפני ' + m + ' דקות';
  }
  function updatePill(){
    var pill = document.getElementById('savePill');
    if(!pill) return;
    var txt = pill.textContent;
    if(pill.classList.contains('saved') && txt !== lastPillText) lastSavedAt = Date.now();
    lastPillText = txt;
    if(pill.classList.contains('saved') && lastSavedAt) pill.setAttribute('data-ago', agoText());
    else pill.removeAttribute('data-ago');
  }
  // ===== התראה: הדוח לא נשמר בענן (v2.2.508) =====
  // אם מחוברים לענן, והשמירה המקומית האחרונה חדשה ביותר מדקה מהשמירה המוצלחת האחרונה לענן —
  // מציגים צ'יפ בולט עם כפתור שמירה ידנית, כדי שדוח לא "ייתקע" רק במכשיר בלי שנדע.
  var lastLocalAt = 0, lastCloudOkAt = Date.now();
  function cloudWatch(){
    var pill = document.getElementById('savePill'); if(!pill) return;
    var t = pill.textContent || '';
    if(/בענן ✓/.test(t)) lastCloudOkAt = Date.now();
    else if(/^נשמר$|שומר…/.test(t)) lastLocalAt = Date.now();
    var logged = !!(G('supabaseClient') && G('cloudCurrentUser'));
    var chip = document.getElementById('rdCloudWarn');
    var warn = logged && navigator.onLine !== false && lastLocalAt > lastCloudOkAt + 60000;
    if(warn && !chip){
      chip = document.createElement('button'); chip.type = 'button'; chip.id = 'rdCloudWarn';
      chip.textContent = '⚠ הדוח לא נשמר בענן — לחץ לשמירה';
      chip.addEventListener('click', function(){
        chip.textContent = '⏳ שומר לענן…';
        Promise.resolve(G('saveReportToCloud')()).then(function(r){
          if(r === true){ lastCloudOkAt = Date.now(); chip.remove(); toast('נשמר בענן ✓'); }
          else { chip.textContent = '⚠ השמירה לענן נכשלה — נסה שוב'; }
        });
      });
      document.body.appendChild(chip);
    } else if(!warn && chip){ chip.remove(); }
  }
  function initSavePill(){
    var pill = document.getElementById('savePill');
    if(!pill) return;
    new MutationObserver(function(){ updatePill(); }).observe(pill, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    setInterval(updatePill, 10000);
    setInterval(cloudWatch, 15000);
    new MutationObserver(cloudWatch).observe(pill, { childList: true, characterData: true, subtree: true });
    updatePill();
  }


  /* ---------------- 6. מיתוג: שם המוצר מימין, לוגו הבודק משמאל ---------------- */
  // שם המוצר — לשינוי כאן בלבד (שורה אחת)
  var RD_BRAND = { name: 'SHAKED', sub: 'TEST REPORTS' };
  function initBrand(){
    var row = document.querySelector('header.top .row1');
    if(!row || document.getElementById('rdBrand')) return;
    var br = document.createElement('div');
    br.id = 'rdBrand';
    br.setAttribute('aria-label', RD_BRAND.name + ' ' + RD_BRAND.sub);
    br.innerHTML = '<span class="rd-brand-mark" aria-hidden="true">⚡</span><span class="rd-brand-name">' + esc(RD_BRAND.name) + '</span><span class="rd-brand-sub">' + esc(RD_BRAND.sub) + '</span>';
    row.insertBefore(br, row.firstChild);
    var logoWrap = document.createElement('div');
    logoWrap.id = 'rdClientLogo';
    logoWrap.innerHTML = '<img alt="לוגו החברה הבודקת">';
    var theme = document.getElementById('rdThemeBtn');
    if(theme) row.insertBefore(logoWrap, theme); else row.appendChild(logoWrap);
    updateLogo();
  }
  function updateLogo(){
    var wrap = document.getElementById('rdClientLogo');
    if(!wrap) return;
    var st = G('state'), src = st && st.settings && st.settings.logo || '';
    var ok = /^(data:image|https?:|blob:)/.test(src);
    var img = wrap.querySelector('img');
    if(ok && img.getAttribute('src') !== src) img.setAttribute('src', src);
    wrap.style.display = ok ? '' : 'none';
  }

  /* ---------------- חיבור ---------------- */
  function enhance(){
    if(enhancing) return;
    enhancing = true;
    try{ document.body.classList.toggle('rd-flat', !!window.RD_FLAT_SUBHEADS && G('activeTab') === 'inspection'); }catch(e){}
    try{ var gr = G('getReportType'); document.body.classList.toggle('rd-fire-form3', typeof gr === 'function' && gr() === 'FIRE_FORM3' && G('activeTab') === 'inspection'); }catch(e){}
    // פרויקט עם כמה דוחות (פרקים): פרטי המזמין / המיקום / תיאור העבודה משותפים ומופיעים רק בדוח הראשון.
    // בדוחות הנוספים מסתירים את סעיף 01 ומציגים הפניה קצרה לדוח הראשון (v2.2.500).
    try{
      var st0 = G('state');
      var secondary = !!(st0 && st0.reportChapters && st0.reportChapters.length && st0.activeChapterIndex !== -1 && G('activeTab') === 'inspection');
      document.body.classList.toggle('rd-secondary-chapter', secondary);
      var meta = app.querySelector('section.card[data-key="meta"]');
      var note = app.querySelector('.rd-shared-meta-note');
      if(secondary && meta && !note){
        note = document.createElement('div');
        note.className = 'rd-shared-meta-note';
        note.innerHTML = '<span>👤 פרטי המזמין והמיקום משותפים לכל הדוחות בפרויקט — הם מופיעים רק בדוח הראשון (עמוד השער).</span><button type="button" data-rdgoprimary="1">↩ עבור לדוח הראשון</button>' +
          '<label class="rd-chdesc">תיאור העבודה לדוח זה<textarea rows="2" data-rdchdesc="1" placeholder="מה נבדק בדוח הזה (מודפס בתחילת הפרק)"></textarea></label>';
        note.querySelector('textarea').value = (st0.meta && st0.meta.description) || '';
        meta.parentNode.insertBefore(note, meta);
      } else if(!secondary && note){ note.remove(); }
    }catch(e){}
    // כרטיס "הצהרת החשמלאי המבצע" בתחתית הטופס — מספור רציף אחרי הכרטיס האחרון (קודם בדוחות כמו
    // התנגדות סגולית הוא הופיע כ-"06" אחרי סעיף 14)
    try{
      var dc = app.querySelector('section.card[data-key="declarations-electrician-only"]');
      if(dc){
        var mx = 0;
        app.querySelectorAll('section.card .card-head .num').forEach(function(n){ if(dc.contains(n)) return; var v = parseInt(n.textContent, 10); if(!isNaN(v) && v > mx && v < 90) mx = v; });
        var nn = dc.querySelector('.card-head .num'), want = String(mx + 1).padStart(2, '0'); if(nn && mx && nn.textContent !== want) nn.textContent = want; // רק כשצריך (אחרת לולאת MutationObserver)
      }
    }catch(e){}
    try{ enhanceOptional(); enhanceBulk(); updateLogo(); enhanceStringPolarity(); enhancePvSignature(); }catch(e){ if(window.console) console.warn('[redesign]', e); }
    enhancing = false;
  }
  function schedule(){ if(!timer) timer = setTimeout(build, 150); }

  function init(){
    app = document.getElementById('app');
    if(!app) return;
    nav = document.createElement('nav');
    nav.id = 'rdNav';
    nav.setAttribute('aria-label', 'ניווט מהיר בחלקי הדוח');
    document.body.appendChild(nav);
    nav.addEventListener('click', function(e){
      if(e.target.closest('button[data-rdtoggle]')){
        var c = !document.body.classList.contains('rd-nav-collapsed');
        document.body.classList.toggle('rd-nav-collapsed', c);
        try{ localStorage.setItem('rdNavCollapsed', c ? '1' : '0'); }catch(err){}
        return;
      }
      var b = e.target.closest('button[data-rdkey]'); if(b) go(b.getAttribute('data-rdkey'));
    });
    try{ if(localStorage.getItem('rdNavCollapsed') === '1') document.body.classList.add('rd-nav-collapsed'); }catch(err){}
    // דוח קוטביות סטרינגים — פעולות על ממיר / לוח DCCB (הוסף / ↑ / ↓ / שכפל / מחק), אותה התנהגות לשניהם.
    // שלב capture + stopPropagation: הכפתורים יושבים בכותרת הכרטיס, וכך הלחיצה לא פותחת/סוגרת אותו.
    app.addEventListener('click', function(e){
      var b = e.target.closest('button[data-spitem]');
      if(!b) return;
      e.stopPropagation(); e.preventDefault();
      if(b.disabled) return;
      var st = G('state'), sp = st && st.stringPolarityReport;
      if(!sp) return;
      var parts = b.getAttribute('data-spitem').split('|'), kind = parts[0], act = parts[1], i = parseInt(parts[2], 10);
      var isInv = kind === 'inv';
      var arr = isInv ? G('getStringPolarityInverters')(sp) : G('getStringPolarityDccbPanels')(sp);
      var mk = isInv ? G('makeStringPolarityInverter') : G('makeStringPolarityDccbPanel');
      var nameNext = G('nextStringItemName'), keyPrefix = isInv ? 'sp-inv-' : 'sp-dccb-', noun = isInv ? 'ממיר' : 'לוח DCCB';
      var freeName = function(base){
        var names = arr.map(function(x){ return String(x.name||'').trim(); }), n = nameNext(base), g = 0;
        while(n && names.indexOf(n) >= 0 && g++ < 500) n = nameNext(n);
        return n;
      };
      var freeDccb = function(base){
        var names = arr.map(function(x){ return String(x.dccbName||'').trim(); }), n = nameNext(base), g = 0;
        while(n && names.indexOf(n) >= 0 && g++ < 500) n = nameNext(n);
        return n;
      };
      var openKey = null;
      var done = function(msg){
        var os = G('openSections'); if(os && openKey) os.add(openKey);
        G('scheduleSave')(); G('render')();
        if(msg) toast(msg);
        if(openKey) setTimeout(function(){ var c = document.querySelector('section.card[data-key="' + openKey + '"]'); if(c) c.scrollIntoView({behavior:'smooth', block:'start'}); }, 60);
      };
      // ניקוי תוצאות מדידה בעותק — המבנה (מספרי מעגלים / FROM-TO / סוג גיד / יחידות) נשאר
      var clearResults = function(item){
        // לפי בקשה: בשכפול ממיר תוצאות הקוטביות *מועתקות* (מעגלים וגידי הזנה); מתח, בידוד, בדיקה ויזואלית והערות — מתנקים
        if(isInv) (item.circuits||[]).forEach(function(c){ c.voltage = ''; c.insulation = ''; c.notes = ''; });
        (item.cables||[]).forEach(function(c){ c.visual = ''; c.insPlus = ''; c.insMinus = ''; c.notes = ''; });
      };
      if(act === 'add'){
        var last = arr[arr.length - 1];
        var p = mk(last && last.name ? freeName(last.name) : '');
        if(isInv && last && last.dccbName) p.dccbName = freeDccb(last.dccbName) || '';
        if(isInv && last && Array.isArray(last.cables) && last.cables.length){
          // ממיר/לוח חדש: אותם גידי הזנה כמו הקודם (FROM/TO/כבל/יחידות), תוצאות ריקות
          p.cables = JSON.parse(JSON.stringify(last.cables));
          p.cables.forEach(function(c){ c.visual = ''; c.polarity = ''; c.insPlus = ''; c.insMinus = ''; c.notes = ''; if(p.dccbName && last.dccbName && c.from === last.dccbName) c.from = p.dccbName; if(p.name && last.name && c.to === last.name) c.to = p.name; });
        }
        arr.push(p); openKey = keyPrefix + p.id; done('נוסף ' + noun + ' #' + arr.length);
      } else if(act === 'up' && i > 0){
        var t = arr[i-1]; arr[i-1] = arr[i]; arr[i] = t; done();
      } else if(act === 'down' && i < arr.length - 1){
        var t2 = arr[i+1]; arr[i+1] = arr[i]; arr[i] = t2; done();
      } else if(act === 'dup'){
        var src = arr[i], cp = JSON.parse(JSON.stringify(src));
        cp.id = mk('').id;
        cp.name = src.name ? (freeName(src.name) || (src.name + ' (עותק)')) : '';
        clearResults(cp);
        if(isInv && src.dccbName) cp.dccbName = freeDccb(src.dccbName) || src.dccbName;
        arr.splice(i + 1, 0, cp); openKey = keyPrefix + cp.id; done(noun + ' שוכפל — הקוטביות הועתקו, מתח ובידוד נוקו למדידה חדשה');
      } else if(act === 'del'){
        if(arr.length < 2){ toast('חייב להישאר לפחות ' + noun + ' אחד'); return; }
        var label = noun + ' #' + (i+1) + (arr[i].name ? ' (' + arr[i].name + ')' : '');
        var go2 = function(){ arr.splice(i, 1); done(noun + ' נמחק'); };
        var cf = G('showAppConfirm');
        if(typeof cf === 'function') cf('למחוק את ' + label + ' וכל הנתונים שבו?').then(function(ok){ if(ok) go2(); });
        else if(window.confirm('למחוק את ' + label + '?')) go2();
      }
    }, true);
    // דוח קוטביות סטרינגים — בחירת סוג הבדיקה, והוספת שורה / סימון מהיר בטבלת מכולות האגירה
    app.addEventListener('click', function(e){
      var b = e.target.closest('button[data-spmode], button[data-spaddstor], button[data-spstorbulk]');
      if(!b) return;
      e.stopPropagation();
      var st = G('state'), sp = st && st.stringPolarityReport;
      if(!sp) return;
      if(b.hasAttribute('data-spmode')){
        var m = b.getAttribute('data-spmode');
        if(sp.mode === m) return;
        sp.mode = m;
        var os = G('openSections'); if(os) os.add(m === 'storage' ? 'sp-storage' : (m === 'ac' ? 'sp-ac' : 'sp-circuits'));
        G('scheduleSave')(); G('render')();
        toast(m === 'storage' ? 'סוג הבדיקה: גידי הזנה ממכולות אגירה' : (m === 'ac' ? 'סוג הבדיקה: גידי AC — הזנה ללוח מנתק' : 'סוג הבדיקה: בדיקת לוחות DCCB'));
        return;
      }
      var kind = b.getAttribute('data-spaddstor') || b.getAttribute('data-spstorbulk') || 'storage';
      var isAc = kind === 'ac';
      var rows = isAc ? G('getStringPolarityAcRows')(sp) : G('getStringPolarityStorageRows')(sp);
      if(b.hasAttribute('data-spaddstor')){
        var last = rows[rows.length - 1] || {}, r = isAc ? G('makeStringPolarityAcRow')() : G('makeStringPolarityStorageRow')();
        r.from = last.from || ''; r.cableType = last.cableType || '';
        r.cableQty = last.cableQty || ''; r.cableSize = last.cableSize || ''; r.cableIns = last.cableIns || ''; r.cableInsOther = last.cableInsOther || '';
        if(isAc){ r.unit = last.unit || 'MΩ'; if(last.grp) r.grp = JSON.parse(JSON.stringify(last.grp)); }
        else { r.insPlusUnit = last.insPlusUnit || 'MΩ'; r.insMinusUnit = last.insMinusUnit || 'MΩ'; }
        rows.push(r);
        G('scheduleSave')(); G('render')();
        var listName = isAc ? 'acRows' : 'storageRows';
        setTimeout(function(){ var inp = document.querySelector('input[data-textpath="stringPolarityReport.' + listName + '.' + (rows.length - 1) + '.to"]'); if(inp){ inp.scrollIntoView({block:'center'}); inp.focus(); } }, 60);
        return;
      }
      var n = 0;
      rows.forEach(function(r){
        if(!(String(r.from||'').trim() || String(r.to||'').trim() || String(r.insPlus||'').trim() || String(r.l1e||'').trim())) return;
        if(!r.visual){ r.visual = 'ok'; n++; }
        if(!r.polarity){ r.polarity = 'ok'; n++; }
      });
      G('scheduleSave')(); G('render')();
      toast(n ? n + ' סימונים עודכנו לתקין' : 'אין שורות פתוחות לסימון');
    });
    // דוח קוטביות סטרינגים: "הוסף גיד הזנה" — מעתיק FROM, כבל ויחידות מהגיד הקודם באותו ממיר
    app.addEventListener('click', function(e){
      var b = e.target.closest('button[data-spaddcable]');
      if(!b) return;
      e.stopPropagation();
      var st = G('state'), getDeep = G('getDeep');
      var arr = getDeep(st, b.getAttribute('data-spaddcable'));
      if(!Array.isArray(arr)) return;
      var last = arr[arr.length - 1] || {}, r = G('makeStringPolarityCable')();
      ['from','cableQty','cableSize','cableIns','cableInsOther','cableType','insPlusUnit','insMinusUnit'].forEach(function(k){ if(last[k] != null && last[k] !== '') r[k] = last[k]; });
      arr.push(r);
      G('scheduleSave')(); G('render')();
    });
    // בחירת כבל פעם אחת → מועתקת לכל השורות הבאות באותה טבלה שעדיין אין בהן כבל
    var SP_CABLE_KEYS = ['cableQty','cableSize','cableIns','cableInsOther','cableType'];
    app.addEventListener('change', function(e){
      var el = e.target;
      var path = el && el.getAttribute && el.getAttribute('data-textpath');
      if(!path || path.indexOf('stringPolarityReport.') !== 0) return;
      var m = path.match(/^(.*)\.(\d+)\.(cableQty|cableSize|cableIns|cableInsOther|cableType)$/);
      if(!m) return;
      var st = G('state'), getDeep = G('getDeep');
      var arr = getDeep(st, m[1]); var i = parseInt(m[2], 10);
      if(!Array.isArray(arr) || !arr[i]) return;
      var src = arr[i];
      src.cableAuto = false;                       // שורה שנערכה ידנית — כבר לא "הועתקה אוטומטית"
      if(!src.cableSize && !src.cableType) return;
      var n = 0;
      for(var j = i + 1; j < arr.length; j++){
        var r = arr[j];
        var empty = !r.cableSize && !String(r.cableType||'').trim();
        var before = window.__rdCableBefore && window.__rdCableBefore.path === (m[1] + '.' + m[2]) ? window.__rdCableBefore.text : null;
        var sameAsBefore = before && G('spCableText')(r) === before;   // שורה שהייתה זהה לכבל הקודם → "כל הגידים תואמים"
        if(!empty && !r.cableAuto && !sameAsBefore) continue;        // שורה שהוזן בה כבל אחר ידנית — לא נוגעים
        SP_CABLE_KEYS.forEach(function(k){ r[k] = src[k] || ''; });
        r.cableAuto = true;
        n++;
      }
      window.__rdCableBefore = { path: m[1] + '.' + m[2], text: G('spCableText')(src) };
      if(n){
        setTimeout(function(){ G('scheduleSave')(); G('render')(); toast('הכבל הועתק ל-' + n + ' שורות הבאות'); }, 0);
      }
    });
    // הערות כסעיפים ממוספרים: הוסף / ↑ / ↓ / מחק, ו-Enter בסוף סעיף פותח סעיף חדש מתחתיו
    var spNoteFocus = function(idx){
      setTimeout(function(){ var t = document.querySelector('textarea[data-spnoteidx="' + idx + '"]'); if(t){ t.focus(); try{ t.setSelectionRange(t.value.length, t.value.length); }catch(e){} } }, 40);
    };
    app.addEventListener('click', function(e){
      var b = e.target.closest('button[data-spnote]');
      if(!b || b.disabled) return;
      e.stopPropagation();
      var st = G('state'), sp = st && st.stringPolarityReport; if(!sp) return;
      var arr = G('getStringPolarityNoteItems')(sp);
      var parts = b.getAttribute('data-spnote').split('|'), act = parts[0], i = parseInt(parts[1], 10), focusIdx = null;
      if(act === 'add'){ arr.push(''); focusIdx = arr.length - 1; }
      else if(act === 'up' && i > 0){ var t = arr[i-1]; arr[i-1] = arr[i]; arr[i] = t; }
      else if(act === 'down' && i < arr.length - 1){ var t2 = arr[i+1]; arr[i+1] = arr[i]; arr[i] = t2; }
      else if(act === 'del'){ arr.splice(i, 1); if(!arr.length) arr.push(''); }
      G('scheduleSave')(); G('render')();
      if(focusIdx !== null) spNoteFocus(focusIdx);
    });
    app.addEventListener('keydown', function(e){
      var t = e.target;
      if(!t || !t.hasAttribute || !t.hasAttribute('data-spnoteidx') || e.key !== 'Enter' || e.shiftKey) return;
      e.preventDefault();
      var st = G('state'), sp = st && st.stringPolarityReport; if(!sp) return;
      var arr = G('getStringPolarityNoteItems')(sp), i = parseInt(t.getAttribute('data-spnoteidx'), 10);
      arr[i] = t.value;
      arr.splice(i + 1, 0, '');
      G('scheduleSave')(); G('render')();
      spNoteFocus(i + 1);
    });
    app.addEventListener('input', function(e){ var t = e.target; if(t && t.getAttribute && /^stringPolarityReport\..*\.(insulation|insPlus|insMinus|l1e|l2e|l3e|l1l2|l2l3|l3l1|l1n|l2n|l3n)$/.test(t.getAttribute('data-textpath')||'')) setTimeout(enhanceStringPolarity, 0); });
    // גובה סעיף גדל עם הטקסט
    app.addEventListener('input', function(e){
      var t = e.target;
      if(t && t.hasAttribute && t.hasAttribute('data-spnoteidx')){ t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }
    });
    // סיכום AI (v2.2.543)
    app.addEventListener('click', function(e){
      var b = e.target.closest('button[data-aisum]');
      if(!b || b.disabled) return;
      e.stopPropagation();
      var act = b.getAttribute('data-aisum');
      if(act === 'undo') G('aiSummaryUndo')();
      else G('runAiSummary')(act);
    });
    // דוח סלילים — הערות ממוספרות (v2.2.539): הוסף / ↑ / ↓ / מחק, Enter פותח הערה חדשה
    var twNoteFocus = function(idx){
      setTimeout(function(){ var t = document.querySelector('textarea[data-twnoteidx="' + idx + '"]'); if(t){ t.focus(); try{ t.setSelectionRange(t.value.length, t.value.length); }catch(e){} } }, 40);
    };
    app.addEventListener('click', function(e){
      var b = e.target.closest('button[data-twnote]');
      if(!b || b.disabled) return;
      e.stopPropagation();
      var st = G('state'), tw = st && st.transformerWindingReport; if(!tw) return;
      var arr = G('getTwNoteItems')(tw);
      var parts = b.getAttribute('data-twnote').split('|'), act = parts[0], i = parseInt(parts[1], 10), focusIdx = null;
      if(act === 'add'){ arr.push(''); focusIdx = arr.length - 1; }
      else if(act === 'up' && i > 0){ var t = arr[i-1]; arr[i-1] = arr[i]; arr[i] = t; }
      else if(act === 'down' && i < arr.length - 1){ var t2 = arr[i+1]; arr[i+1] = arr[i]; arr[i] = t2; }
      else if(act === 'del'){ arr.splice(i, 1); if(!arr.length) arr.push(''); }
      G('scheduleSave')(); G('render')();
      if(focusIdx !== null) twNoteFocus(focusIdx);
    });
    app.addEventListener('keydown', function(e){
      var t = e.target;
      if(!t || !t.hasAttribute || !t.hasAttribute('data-twnoteidx') || e.key !== 'Enter' || e.shiftKey) return;
      e.preventDefault();
      var st = G('state'), tw = st && st.transformerWindingReport; if(!tw) return;
      var arr = G('getTwNoteItems')(tw), i = parseInt(t.getAttribute('data-twnoteidx'), 10);
      arr[i] = t.value;
      arr.splice(i + 1, 0, '');
      G('scheduleSave')(); G('render')();
      twNoteFocus(i + 1);
    });
    app.addEventListener('input', function(e){
      var t = e.target;
      if(t && t.hasAttribute && t.hasAttribute('data-twnoteidx')){ t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }
    });
    // ===================== מילוי מהיר (v2.2.481) =====================
    var CABLE_KEYS = ['cableQty','cableSize','cableIns','cableInsOther','cableType'];
    var copyCable = function(dst, src){ CABLE_KEYS.forEach(function(k){ dst[k] = (src && src[k]) || ''; }); if(!dst.cableQty) dst.cableQty = ''; };
    var fillTpl = function(tpl, vars){ return String(tpl||'').replace(/\{(\w)\}/g, function(m, k){ return vars[k] != null ? vars[k] : m; }); };
    var parseList = function(str){
      var out = [];
      String(str||'').split(/[,،;]+/).map(function(t){ return t.trim(); }).filter(Boolean).forEach(function(t){
        var m = t.match(/^(\D*?)(\d+)\s*[-–]\s*(\D*?)(\d+)$/);
        if(m && (!m[3] || m[3] === m[1]) && parseInt(m[4],10) >= parseInt(m[2],10) && parseInt(m[4],10) - parseInt(m[2],10) < 200){
          for(var n = parseInt(m[2],10); n <= parseInt(m[4],10); n++) out.push(m[1] + n);
        } else out.push(t);
      });
      return out;
    };
    var trailingNum = function(name, fallback){ var m = String(name||'').match(/(\d+)\s*$/); return m ? m[1] : String(fallback); };
    var rowHasData = function(r){ return Object.keys(r).some(function(k){ return !/Unit$|^unit$|^cable/.test(k) && String(r[k]||'').trim(); }); };

    app.addEventListener('click', function(e){
      var b = e.target.closest('button[data-spgen], button[data-sptpl], button[data-spexc], button[data-spgt100]');
      if(!b) return;
      e.stopPropagation();
      var st = G('state'), sp = st && st.stringPolarityReport; if(!sp) return;
      var gen = sp.gen || {};
      var done = function(msg){ G('scheduleSave')(); G('render')(); if(msg) toast(msg); };

      // ---- "> 100" לכל שדות הבידוד הריקים בשורה
      if(b.hasAttribute('data-spgt100')){
        var pr = b.getAttribute('data-spgt100').split('|'), row = G('getDeep')(st, pr[0])[parseInt(pr[1],10)];
        var acKeys = /acRows/.test(pr[0]) ? G('spAcRowFields')(G('state').stringPolarityReport, row).map(function(f){ return f[0]; }) : [];
        ['insPlus','insMinus','l1e','l2e','l3e','l1l2','l2l3','l3l1','l1n','l2n','l3n'].forEach(function(k){ if(k in row && !String(row[k]||'').trim() && (/^(insPlus|insMinus)$/.test(k) || acKeys.indexOf(k) >= 0)) row[k] = '> 100'; });
        return done();
      }

      // ---- מחולל שורות
      if(b.hasAttribute('data-spgen')){
        var kind = b.getAttribute('data-spgen');
        if(kind === 'storage'){
          var froms = parseList(gen.storFrom || 'PCS1-PCS4'), counts = String(gen.storCounts || '10').split(/[,،;\s]+/).filter(Boolean).map(function(x){ return parseInt(x,10) || 0; });
          if(!froms.length){ toast('יש לרשום FROM'); return; }
          var rows = G('getStringPolarityStorageRows')(sp), fresh = [], nRun = 0;
          froms.forEach(function(f, fi){
            var cnt = counts.length > 1 ? (counts[fi] || 0) : (counts[0] || 0);
            for(var k = 1; k <= cnt; k++){
              nRun++;
              var r = G('makeStringPolarityStorageRow')();
              r.from = f; r.to = fillTpl(gen.storTo || '{p}.{k}.1', { p: trailingNum(f, fi+1), k: k, n: nRun });
              copyCable(r, gen.stor);
              fresh.push(r);
            }
          });
          if(!fresh.length){ toast('כמות השורות 0'); return; }
          if(!rows.some(rowHasData)) rows.length = 0;
          Array.prototype.push.apply(rows, fresh);
          return done('נוצרו ' + fresh.length + ' שורות');
        }
        if(kind === 'ac'){
          var cntA = parseInt(gen.acCount || '8', 10) || 0;
          if(!cntA){ toast('יש לרשום כמה שורות'); return; }
          var rowsA = G('getStringPolarityAcRows')(sp), freshA = [];
          for(var n = 1; n <= cntA; n++){
            var ra = G('makeStringPolarityAcRow')();
            ra.from = gen.acFrom || ''; ra.to = fillTpl(gen.acTo || 'INV-{n}', { n: n, k: n, p: n });
            copyCable(ra, gen.ac);
            freshA.push(ra);
          }
          if(!rowsA.some(rowHasData)) rowsA.length = 0;
          Array.prototype.push.apply(rowsA, freshA);
          return done('נוצרו ' + freshA.length + ' שורות');
        }
        if(kind === 'dccb'){
          var cntI = parseInt(gen.invCount || '8', 10) || 0, cCnt = parseInt(gen.circuits || '10', 10) || 0, fCnt = parseInt(gen.feeds || '1', 10) || 0;
          if(!cntI){ toast('יש לרשום כמה ממירים'); return; }
          var invs = G('getStringPolarityInverters')(sp);
          var invEmpty = invs.every(function(iv){ return !iv.name && !iv.dccbName && !iv.circuits.some(function(c){ return c.voltage || c.polarity || c.insulation || c.notes; }) && !(iv.cables||[]).some(rowHasData); });
          var freshI = [];
          for(var q = 1; q <= cntI; q++){
            var iv = G('makeStringPolarityInverter')(fillTpl(gen.invName || 'INV-{n}', { n: q }));
            iv.dccbName = fillTpl(gen.dccbName || 'DCCB-{n}', { n: q });
            iv.circuits = [];
            for(var c = 1; c <= cCnt; c++) iv.circuits.push(G('makeStringPolarityCircuit')(c, 'MΩ'));
            iv.cables = [];
            var shortName = String(iv.name).split(' (')[0];
            for(var f2 = 0; f2 < Math.max(fCnt, 1); f2++){
              var cb = G('makeStringPolarityCable')(); cb.from = iv.dccbName; cb.to = shortName; copyCable(cb, gen.dccb); iv.cables.push(cb);
            }
            freshI.push(iv);
          }
          if(invEmpty) invs.length = 0;
          Array.prototype.push.apply(invs, freshI);
          var os = G('openSections'); if(os && freshI[0]) os.add('sp-inv-' + freshI[0].id);
          return done('נוצרו ' + freshI.length + ' ממירים');
        }
      }

      // ---- תבנית אתר (נשמרת במכשיר)
      if(b.hasAttribute('data-sptpl')){
        var act = b.getAttribute('data-sptpl'), all = {};
        try{ all = JSON.parse(localStorage.getItem('rdSpTemplates') || '{}') || {}; }catch(err){ all = {}; }
        var sel = document.getElementById('spTplSelect');
        if(act === 'save'){
          var m = st.meta || {}, defName = [m.siteName || m.client || 'אתר', ({dccb:'לוחות DCCB', storage:'מכולות אגירה', ac:'גידי AC'})[sp.mode || 'dccb']].join(' — ');
          var name = window.prompt('שם לתבנית:', defName);
          if(!name) return;
          var copy = JSON.parse(JSON.stringify(sp));
          delete copy.gen;
          (copy.inverters||[]).forEach(function(iv){ (iv.circuits||[]).forEach(function(c){ c.voltage=''; c.polarity=''; c.insulation=''; c.notes=''; }); (iv.cables||[]).forEach(function(c){ c.visual=''; c.polarity=''; c.insPlus=''; c.insMinus=''; c.notes=''; }); });
          (copy.storageRows||[]).forEach(function(r){ r.visual=''; r.polarity=''; r.insPlus=''; r.insMinus=''; r.notes=''; });
          (copy.acRows||[]).forEach(function(r){ r.visual=''; r.polarity=''; ['l1e','l2e','l3e','l1l2','l2l3','l3l1'].forEach(function(k){ r[k]=''; }); r.notes=''; });
          copy.noteItems = ['']; copy.generalNotes = '';
          all[name] = { savedAt: new Date().toISOString(), data: copy };
          try{ localStorage.setItem('rdSpTemplates', JSON.stringify(all)); }catch(err){ toast('שמירה נכשלה'); return; }
          toast('התבנית "' + name + '" נשמרה'); fillTplSelect(); return;
        }
        var chosen = sel && sel.value;
        if(!chosen || !all[chosen]){ toast('יש לבחור תבנית מהרשימה'); return; }
        if(act === 'del'){
          if(!window.confirm('למחוק את התבנית "' + chosen + '"?')) return;
          delete all[chosen]; localStorage.setItem('rdSpTemplates', JSON.stringify(all)); fillTplSelect(); toast('התבנית נמחקה'); return;
        }
        if(act === 'load'){
          var go3 = function(){
            var d = JSON.parse(JSON.stringify(all[chosen].data));
            ['mode','testVoltage','insulationUnit','minInsMOhm','inverters','storageRows','acRows'].forEach(function(k){ if(d[k] !== undefined) sp[k] = d[k]; });
            (sp.inverters||[]).forEach(function(iv){ iv.id = G('makeStringPolarityInverter')('').id; });
            done('המבנה נטען מהתבנית "' + chosen + '" — נשאר למלא מדידות');
          };
          var cf = G('showAppConfirm'), msg = 'לטעון את המבנה מהתבנית "' + chosen + '"? הטבלאות הנוכחיות יוחלפו (פרטי המתקן וההערות לא משתנים).';
          if(typeof cf === 'function') cf(msg).then(function(ok){ if(ok) go3(); }); else if(window.confirm(msg)) go3();
          return;
        }
      }

      // ---- חריגים → הערות / מסקנה
      if(b.hasAttribute('data-spexc')){
        var ex = collectExceptions(sp);
        if(b.getAttribute('data-spexc') === 'notes'){
          if(!ex.length){ toast('לא נמצאו חריגים'); return; }
          var items = G('getStringPolarityNoteItems')(sp), added = 0;
          if(items.length === 1 && !String(items[0]||'').trim()) items.length = 0;
          ex.forEach(function(t){ if(items.indexOf(t) < 0){ items.push(t); added++; } });
          var os2 = G('openSections'); if(os2) os2.add('sp-notes');
          return done(added ? 'נוספו ' + added + ' הערות מהחריגים' : 'ההערות כבר קיימות');
        } else {
          var opts = G('APPROVAL_OPTIONS') || [];
          st.approvalStatus = ex.length ? (opts[1] || st.approvalStatus) : (opts[0] || st.approvalStatus);
          return done('מסקנה מוצעת: ' + st.approvalStatus + (ex.length ? ' (' + ex.length + ' חריגים)' : ''));
        }
      }
    });

    // רשימת החריגים בדוח (לא תקין / בידוד מתחת לסף)
    function collectExceptions(sp){
      var low = G('spIsLow'), out = [], unitDef = sp.insulationUnit || 'MΩ';
      var fix = ' — יש לתקן ולבצע מדידה חוזרת.';
      var insTxt = function(v, u){ return v + ' ' + (u || unitDef); };
      if(sp.mode === 'storage'){
        (sp.storageRows||[]).forEach(function(r, i){
          var id = 'שורה ' + (i+1) + ' (' + (r.from||'—') + ' ← ' + (r.to||'—') + ')';
          if(r.visual === 'bad') out.push(id + ': בדיקה ויזואלית לא תקינה' + fix);
          if(r.polarity === 'bad') out.push(id + ': קוטביות לא תקינה' + fix);
          if(low(r.insPlus, r.insPlusUnit)) out.push(id + ': בידוד (+) להארקה נמוך (' + insTxt(r.insPlus, r.insPlusUnit) + ')' + fix);
          if(low(r.insMinus, r.insMinusUnit)) out.push(id + ': בידוד (-) להארקה נמוך (' + insTxt(r.insMinus, r.insMinusUnit) + ')' + fix);
        });
      } else if(sp.mode === 'ac'){
        (sp.acRows||[]).forEach(function(r, i){
          var L = {};
          G('spAcRowFields')(sp, r).forEach(function(f){ L[f[0]] = f[1]; });
          var id = 'שורה ' + (i+1) + ' (' + (r.from||'—') + ' ← ' + (r.to||'—') + ')';
          if(r.visual === 'bad') out.push(id + ': בדיקה ויזואלית לא תקינה' + fix);
          if(r.polarity === 'bad') out.push(id + ': קוטביות לא תקינה' + fix);
          Object.keys(L).forEach(function(k){ if(low(r[k], r.unit)) out.push(id + ': בידוד ' + L[k] + ' נמוך (' + insTxt(r[k], r.unit) + ')' + fix); });
        });
      } else {
        (sp.inverters||[]).forEach(function(iv, ii){
          var inv = String(iv.name || ('ממיר ' + (ii+1))).split(' (')[0];
          (iv.circuits||[]).forEach(function(c){
            if(c.polarity === 'bad') out.push(inv + ' מעגל ' + (c.circuit||'?') + ': קוטביות לא תקינה' + fix);
            if(low(c.insulation, c.insulationUnit)) out.push(inv + ' מעגל ' + (c.circuit||'?') + ': בידוד נמוך (' + insTxt(c.insulation, c.insulationUnit) + ')' + fix);
          });
          (iv.cables||[]).forEach(function(c, ci){
            var id = inv + ' גיד הזנה ' + (ci+1) + ' (' + (c.from||'—') + ' ← ' + (c.to||'—') + ')';
            if(c.visual === 'bad') out.push(id + ': בדיקה ויזואלית לא תקינה' + fix);
            if(c.polarity === 'bad') out.push(id + ': קוטביות לא תקינה' + fix);
            if(low(c.insPlus, c.insPlusUnit)) out.push(id + ': בידוד (+) נמוך (' + insTxt(c.insPlus, c.insPlusUnit) + ')' + fix);
            if(low(c.insMinus, c.insMinusUnit)) out.push(id + ': בידוד (-) נמוך (' + insTxt(c.insMinus, c.insMinusUnit) + ')' + fix);
          });
        });
      }
      return out;
    }
    function fillTplSelect(){
      var sel = document.getElementById('spTplSelect'); if(!sel) return;
      var all = {}; try{ all = JSON.parse(localStorage.getItem('rdSpTemplates') || '{}') || {}; }catch(err){}
      var names = Object.keys(all), cur = sel.value;
      var sig = 'n:' + names.join('|'); if(sel.getAttribute('data-sig') === sig) return;   // בלי שינוי → לא נוגעים ב-DOM (מונע לולאת MutationObserver)
      sel.setAttribute('data-sig', sig);
      sel.innerHTML = '<option value="">— תבניות שמורות (' + names.length + ') —</option>' + names.map(function(n){ return '<option>' + esc(n) + '</option>'; }).join('');
      if(names.indexOf(cur) >= 0) sel.value = cur;
    }
    window.__rdFillTplSelect = fillTplSelect;
    window.__rdGenOpen = window.__rdGenOpen || {};
    app.addEventListener('toggle', function(e){
      var d = e.target; if(!d || !d.classList || !d.classList.contains('sp-gen')) return;
      var c = d.closest('section.card'); if(c) window.__rdGenOpen[c.getAttribute('data-key')] = d.open;
    }, true);
    window.__rdCollectExceptions = collectExceptions;

    // מספר מעגל: רושמים מספר בשורה → כל השורות הבאות מתמספרות ברצף
    app.addEventListener('change', function(e){
      var el = e.target, path = el && el.getAttribute && el.getAttribute('data-textpath');
      var m = path && path.match(/^(stringPolarityReport\.inverters\.\d+\.circuits)\.(\d+)\.circuit$/);
      if(!m) return;
      var arr = G('getDeep')(G('state'), m[1]), i = parseInt(m[2], 10), nx = G('nextStringCircuitNumber');
      arr[i].circuit = el.value;
      if(!nx(el.value)) return;
      // מעדכנים את הנתונים ואת השדות שעל המסך ישירות — בלי לבנות את הטופס מחדש. בנייה מחדש ברגע
      // היציאה מהשדה (כשנוגעים בשדה אחר) העלימה את השדה שנגעת בו, סגרה את המקלדת והקפיצה את הטבלה.
      var changed = 0;
      for(var j = i + 1; j < arr.length; j++){
        var nv = nx(arr[j-1].circuit);
        if(arr[j].circuit === nv) continue;
        arr[j].circuit = nv; changed++;
        var inp = app.querySelector('input[data-textpath="' + m[1] + '.' + j + '.circuit"]');
        if(inp && document.activeElement !== inp) inp.value = nv;
      }
      if(!changed) return;
      G('scheduleSave')();
      toast('המעגלים הבאים מוספרו ברצף');
    });

    // לפני שינוי כבל — שומרים את הכבל הקודם (שלב capture: רץ לפני שהטופס מעדכן את הנתונים ומרנדר מחדש),
    // כדי לעדכן גם שורות שהיו זהות לו ("כל הגידים תואמים")
    app.addEventListener('change', function(e){
      var el = e.target, path = el && el.getAttribute && el.getAttribute('data-textpath');
      var m = path && path.match(/^(.*)\.(\d+)\.(cableQty|cableSize|cableIns|cableInsOther|cableType)$/);
      if(!m) return;
      var row = (G('getDeep')(G('state'), m[1]) || [])[parseInt(m[2],10)];
      if(row) window.__rdCableBefore = { path: m[1] + '.' + m[2], text: G('spCableText')(row) };
    }, true);

    // בחירת תקין / לא תקין / ל״ר בחלונית — מעדכנים רק את הנתון ואת הצבע, בלי לבנות את הטופס מחדש.
    // (בנייה מחדש החזירה את הטבלה לתחילתה — "הטבלה קופצת". שלב capture: רץ לפני הטיפול הכללי
    // של הטופס בחלוניות בחירה, ו-stopPropagation מונע ממנו לרנדר.)
    app.addEventListener('change', function(e){
      var el = e.target;
      if(!el || !el.matches || !el.matches('select.sp-status-sel[data-textpath]')) return;
      e.stopPropagation();
      var st = G('state'); G('setDeep')(st, el.getAttribute('data-textpath'), el.value);
      el.classList.remove('sp-st-ok', 'sp-st-bad', 'sp-st-na', 'sp-st-empty');
      el.classList.add(el.value === 'ok' ? 'sp-st-ok' : (el.value === 'bad' ? 'sp-st-bad' : (el.value === 'na' ? 'sp-st-na' : 'sp-st-empty')));
      var card = el.closest('.sp-row-card');
      if(card) card.classList.toggle('sp-row-bad', !!card.querySelector('select.sp-status-sel.sp-st-bad'));
      G('scheduleSave')();
      enhanceStringPolarity();
      lastSig = ''; schedule();
    }, true);
    // צמצום / הרחבה של תת-סעיף בתוך חלון ממיר (גידי הזנה / מעגלים)
    app.addEventListener('click', function(e){
      var b = e.target.closest('button[data-spsec]');
      if(!b) return;
      e.stopPropagation();
      var parts = b.getAttribute('data-spsec').split('|'), sp = G('state').stringPolarityReport;
      var inv = sp && sp.inverters && sp.inverters[parseInt(parts[1], 10)];
      if(!inv) return;
      var key = parts[0] === 'feeds' ? 'feedsCollapsed' : 'circuitsCollapsed';
      inv[key] = !inv[key];
      G('scheduleSave')(); G('render')();
    });
    // "לכל העמודה ▾" — קובע סטטוס אחד לכל השורות בעמודה (קוטביות / ויזואלית)
    app.addEventListener('change', function(e){
      var el = e.target;
      if(!el || !el.matches || !el.matches('select.sp-colset[data-spcolset]')) return;
      e.stopPropagation();
      var parts = el.getAttribute('data-spcolset').split('|'), val = el.value, isClear = el.selectedIndex === el.options.length - 1;
      el.selectedIndex = 0;
      if(!val && !isClear) return;
      var st = G('state'), arr = G('getDeep')(st, parts[0]), field = parts[1];
      if(!Array.isArray(arr) || !arr.length) return;
      var names = { ok:'תקין', bad:'לא תקין', na:'ל״ר' };
      var others = arr.filter(function(r){ return r[field] && r[field] !== val; }).length;
      var apply = function(){
        arr.forEach(function(r){ r[field] = val; });
        G('scheduleSave')(); G('render')();
        toast(isClear ? 'הסטטוס נוקה בכל ' + arr.length + ' השורות' : 'כל ' + arr.length + ' השורות סומנו ' + names[val]);
      };
      if(others){
        var msg = (isClear ? 'לנקות את הסטטוס' : 'לסמן "' + names[val] + '"') + ' בכל ' + arr.length + ' השורות? ' + others + ' שורות מסומנות כרגע אחרת ויוחלפו.';
        var cf = G('showAppConfirm');
        if(typeof cf === 'function') cf(msg).then(function(ok){ if(ok) apply(); }); else if(window.confirm(msg)) apply();
      } else apply();
    }, true);
    // כבל מתח גבוה — תמונת אזור הבדיקה (דחיסה ל-1400px, נשמרת בדוח)
    app.addEventListener('change', function(e){
      var inp = e.target;
      if(!inp || !inp.matches || !inp.matches('input[type=file][data-hcareaphoto]')) return;
      e.stopPropagation();
      var f = inp.files && inp.files[0]; if(!f) return;
      var ci = G('compressImage');
      Promise.resolve(typeof ci === 'function' ? ci(f, 1400, 0.82) : null).then(function(url){
        if(!url){ toast('לא ניתן לקרוא את התמונה'); return; }
        var im = new Image();
        im.onload = function(){
          var hc = G('state').hvCableReport;
          hc.testAreaPhoto = url;
          hc.testAreaPhotoRatio = im.naturalHeight ? String((im.naturalWidth / im.naturalHeight).toFixed(4)) : '';
          G('scheduleSave')(); G('render')(); toast('התמונה נוספה');
        };
        im.onerror = function(){ toast('לא ניתן לקרוא את התמונה'); };
        im.src = url;
      }).catch(function(){ toast('לא ניתן לקרוא את התמונה'); });
    }, true);
    app.addEventListener('click', function(e){
      var b = e.target.closest('button[data-hcareaphotodel]'); if(!b) return;
      e.stopPropagation();
      var go = function(){ G('state').hvCableReport.testAreaPhoto = ''; G('state').hvCableReport.testAreaPhotoRatio = ''; G('scheduleSave')(); G('render')(); };
      var cf = G('showAppConfirm');
      if(typeof cf === 'function') cf('להסיר את תמונת אזור הבדיקה?').then(function(ok){ if(ok) go(); }); else if(window.confirm('להסיר את התמונה?')) go();
    });
    // כבל מתח גבוה — מקבילות/פאזות וסטטוס בחלונית (תקין / לא תקין / לא רלוונטי): מעדכנים בלי לבנות את
    // הטופס מחדש. פאזות "לא תקין" נועלות את הסטטוס על "לא תקין" (כמו בגרסה הקודמת).
    app.addEventListener('change', function(e){
      var el = e.target;
      if(!el || !el.matches || !el.matches('select.hc-sel[data-textpath]')) return;
      e.stopPropagation();
      var st = G('state'), path = el.getAttribute('data-textpath');
      G('setDeep')(st, path, el.value);
      var paint = function(sel){
        var v = sel.value;
        sel.classList.remove('hc-st-ok', 'hc-st-bad', 'hc-st-na', 'hc-st-empty');
        sel.classList.add(v === 'תקין' ? 'hc-st-ok' : (v === 'לא תקין' ? 'hc-st-bad' : (v ? 'hc-st-na' : 'hc-st-empty')));
      };
      paint(el);
      var card = el.closest('.sp-row-card');
      if(el.hasAttribute('data-hcphase') && card){
        var base = path.replace(/\.phaseSequenceResult$/, '');
        var stSel = card.querySelector('select[data-hcstatus]');
        if(el.value === 'לא תקין'){
          G('setDeep')(st, base + '.status', 'לא תקין');
          if(stSel){ stSel.value = 'לא תקין'; stSel.disabled = true; paint(stSel); }
        } else if(stSel && stSel.disabled){ stSel.disabled = false; }
      }
      if(card) card.classList.toggle('sp-row-bad', !!card.querySelector('select.hc-sel.hc-st-bad'));
      G('scheduleSave')();
      lastSig = ''; schedule();
    }, true);
    // כבל מתח גבוה — בחירת שיטות הבדיקה (אפשר כמה יחד; לפחות אחת תמיד מסומנת)
    app.addEventListener('click', function(e){
      var b = e.target.closest('button[data-hcmethod]'); if(!b) return;
      e.stopPropagation();
      var hc = G('state').hvCableReport, k = b.getAttribute('data-hcmethod');
      var m = Object.assign({ standard: true, temp: false, dar: false, pi: false, sheath: false }, hc.testMethods || {});
      m[k] = !m[k];
      if(!m.standard && !m.temp && !m.dar && !m.pi && !m.sheath){ toast('יש לבחור לפחות שיטת בדיקה אחת'); return; }
      hc.testMethods = m;
      G('scheduleSave')(); G('render')();
    });
    // תיאור העבודה של דוח נוסף (שדה פר-פרק) — נערך מתוך ההפניה, כי סעיף 01 מוסתר בדוחות הנוספים
    app.addEventListener('input', function(e){
      var t = e.target; if(!t || !t.hasAttribute || !t.hasAttribute('data-rdchdesc')) return;
      G('state').meta.description = t.value; G('scheduleSave')();
    });
    app.addEventListener('click', function(e){
      if(!e.target.closest('button[data-rdgoprimary]')) return;
      e.stopPropagation();
      var sw = G('switchToChapter'); if(typeof sw === 'function'){ sw(-1); G('render')(); window.scrollTo(0, 0); }
    });
    // צמצום/הרחבה של שורת בדיקה (מלבן) — מכולות, AC, כבל מ"ג; וגם לכל השורות יחד; ובדיקת L-N ב-AC
    app.addEventListener('click', function(e){
      var b = e.target.closest('button[data-sprowtoggle], button[data-sprowsall]'); if(!b) return;
      e.stopPropagation();
      var st = G('state'), getDeep = G('getDeep');
      if(b.hasAttribute('data-sprowtoggle')){
        var pr = b.getAttribute('data-sprowtoggle').split('|'), arr = getDeep(st, pr[0]), r = arr && arr[parseInt(pr[1],10)];
        if(!r) return; r.collapsed = !r.collapsed;
      } else {
        var pa = b.getAttribute('data-sprowsall').split('|'), arr2 = getDeep(st, pa[0]) || [], v = pa[1] === '1';
        arr2.forEach(function(x){ x.collapsed = v; });
      }
      G('scheduleSave')(); G('render')();
    });
    // גידי AC — בחירת הבדיקות לכל שורה בנפרד (✓ ליד כל כותרת בתוך השורה)
    app.addEventListener('change', function(e){
      var c = e.target; if(!c || !c.matches || !c.matches('input[data-spacrowgrp]')) return;
      e.stopPropagation();
      var p = c.getAttribute('data-spacrowgrp').split('|'), sp = G('state').stringPolarityReport, r = sp.acRows[parseInt(p[0],10)];
      if(!r) return;
      var g = G('spAcRowGroups')(sp, r);
      g[p[1]] = !!c.checked;
      if(!g.le && !g.ll && !g.ln){ c.checked = true; toast('בכל שורה צריכה להישאר לפחות בדיקה אחת'); return; }
      r.grp = g;
      G('scheduleSave')(); G('render')();
    }, true);
    // גידי AC — בחירת קבוצות הבדיקה (L-e / L-L / L-N); לפחות אחת תמיד מסומנת
    app.addEventListener('change', function(e){
      var c = e.target; if(!c || !c.matches || !c.matches('input[data-spacgrp]')) return;
      e.stopPropagation();
      var sp = G('state').stringPolarityReport, g = G('spAcGroups')(sp), k = c.getAttribute('data-spacgrp');
      g[k] = !!c.checked;
      if(!g.le && !g.ll && !g.ln){ c.checked = true; toast('יש לבחור לפחות בדיקה אחת'); return; }
      sp.acGroups = g; sp.acIncludeLN = g.ln;
      G('scheduleSave')(); G('render')();
    }, true);
    // סדר הדוחות (פרקים) ב-PDF
    app.addEventListener('click', function(e){
      var b = e.target.closest('button[data-rdchorder]'); if(!b || b.disabled) return;
      e.stopPropagation();
      var v = b.getAttribute('data-rdchorder');
      if(v === 'toggle'){ window.__rdChOrderOpen = !window.__rdChOrderOpen; G('render')(); return; }
      var st = G('state'), parts = v.split('|'), i = parseInt(parts[1], 10), order = G('getChapterPrintOrder')();
      var j = parts[0] === 'up' ? i - 1 : i + 1;
      if(j < 0 || j >= order.length) return;
      var t = order[i]; order[i] = order[j]; order[j] = t;
      st.chapterPrintOrder = order;
      G('scheduleSave')(); G('render')(); toast('הסדר עודכן — ה-PDF ייבנה בסדר הזה');
    }, true);
    // ממסרי הגנה — הוספת ממסר לפי דגם, ומתגי DIP (לחיצה = ON/OFF, בלי לבנות את הטופס מחדש)
    app.addEventListener('click', function(e){
      var b = e.target.closest('button[data-reladd], button[data-reldip]'); if(!b) return;
      e.stopPropagation();
      var st = G('state');
      if(!Array.isArray(st.protectionRelays)) st.protectionRelays = [];
      if(b.hasAttribute('data-reladd')){
        var r = G('makeProtectionRelay')(b.getAttribute('data-reladd'));
        st.protectionRelays.push(r);
        var os = G('openSections'); if(os) os.add('protection-relays');
        G('scheduleSave')(); G('render')(); toast('נוסף ממסר ' + r.model);
        return;
      }
      var p = b.getAttribute('data-reldip').split('|'), rel = st.protectionRelays[parseInt(p[0],10)];
      if(!rel) return;
      rel.dips = rel.dips || {};
      var n = parseInt(p[3],10), bits = G('relayDipBits')(rel.dips[p[1]], n).split(''), bi = parseInt(p[2],10);
      bits[bi] = bits[bi] === '1' ? '0' : '1';
      rel.dips[p[1]] = bits.join('');
      b.classList.toggle('on', bits[bi] === '1');
      b.title = 'מתג ' + (bi+1) + ': ' + (bits[bi] === '1' ? 'ON' : 'OFF');
      G('scheduleSave')();
    });
    // טופס PV — הצהרת הבודק (א/ב) והוספת הערה מוכנה לטבלה 12
    app.addEventListener('change', function(e){
      var el = e.target; if(!el || !el.matches) return;
      if(el.matches('input[data-pvverdict]')){
        e.stopPropagation();
        G('getPvInspection')().verdict = el.getAttribute('data-pvverdict');
        G('scheduleSave')(); return;
      }
      if(el.matches('select[data-pvnotepreset]')){
        e.stopPropagation();
        var i = parseInt(el.value, 10); if(isNaN(i)) return;
        var pv = G('getPvInspection')(), txt = G('PV_NOTE_PRESETS')[i];
        if(!pv.t12.some(function(r){ return r.text === txt; })) pv.t12.push({ text: txt, response: '' });
        G('scheduleSave')(); G('render')(); toast('ההערה נוספה');
      }
    }, true);
    // דוח גמיש — סעיפים ממוספרים בפרק: הוספה / ↑ / ↓ / מחיקה, מעבר מלל חופשי ↔ סעיפים, Enter = סעיף חדש
    var flexFocus = function(ri, i){ setTimeout(function(){ var t = app.querySelector('textarea[data-flexitemidx="' + ri + '|' + i + '"]'); if(t){ t.focus(); try{ t.setSelectionRange(t.value.length, t.value.length); }catch(e){} } }, 40); };
    app.addEventListener('click', function(e){
      var b = e.target.closest('button[data-flexitem], button[data-flexitemsmode]'); if(!b || b.disabled) return;
      e.stopPropagation();
      var fr = G('state').flexibleReport;
      if(b.hasAttribute('data-flexitemsmode')){
        var pm = b.getAttribute('data-flexitemsmode').split('|'), sec0 = fr.sections[parseInt(pm[0],10)], on = pm[1] === '1';
        if(!sec0 || !!sec0.itemsMode === on) return;
        if(on){ // מלל → סעיפים: כל שורה הופכת לסעיף (מספור ידני "1." מוסר)
          var lines = String(sec0.content || '').split('\n').map(function(l){ return l.replace(/^\s*\d+\s*[.)\-]\s*/, '').trim(); }).filter(Boolean);
          sec0.items = lines.length ? lines : (Array.isArray(sec0.items) && sec0.items.length ? sec0.items : ['']);
        } else { // סעיפים → מלל: "1. ..." בשורה לכל סעיף
          var its = (sec0.items || []).map(function(t){ return String(t||'').trim(); }).filter(Boolean);
          if(its.length) sec0.content = its.map(function(t, i){ return (i+1) + '. ' + t; }).join('\n');
        }
        sec0.itemsMode = on;
        G('scheduleSave')(); G('render')(); return;
      }
      var p = b.getAttribute('data-flexitem').split('|'), act = p[0], ri = parseInt(p[1],10), i = parseInt(p[2],10);
      var sec = fr.sections[ri]; if(!sec) return;
      if(!Array.isArray(sec.items)) sec.items = [''];
      var arr = sec.items, focusIdx = null;
      if(act === 'add'){ arr.push(''); focusIdx = arr.length - 1; }
      else if(act === 'up' && i > 0){ var t = arr[i-1]; arr[i-1] = arr[i]; arr[i] = t; }
      else if(act === 'down' && i < arr.length - 1){ var t2 = arr[i+1]; arr[i+1] = arr[i]; arr[i] = t2; }
      else if(act === 'del'){ arr.splice(i, 1); if(!arr.length) arr.push(''); }
      G('scheduleSave')(); G('render')();
      if(focusIdx !== null) flexFocus(ri, focusIdx);
    });
    app.addEventListener('keydown', function(e){
      var t = e.target;
      if(!t || !t.hasAttribute || !t.hasAttribute('data-flexitemidx') || e.key !== 'Enter' || e.shiftKey) return;
      e.preventDefault();
      var p = t.getAttribute('data-flexitemidx').split('|'), ri = parseInt(p[0],10), i = parseInt(p[1],10);
      var sec = G('state').flexibleReport.sections[ri]; if(!sec) return;
      sec.items[i] = t.value; sec.items.splice(i + 1, 0, '');
      G('scheduleSave')(); G('render')(); flexFocus(ri, i + 1);
    });
    // דוח טיפול בלוחות — צ'ק ליסט, הוספת כמה לוחות בבת אחת, שכפול לוח
    app.addEventListener('click', function(e){
      var b = e.target.closest('button[data-flexcladd], button[data-flexbulkpanels], button[data-flexsecdup]'); if(!b) return;
      e.stopPropagation();
      var st = G('state'), fr = st.flexibleReport, isPanel = G('isFlexPanelSection'), isCl = G('isFlexChecklistSection'), tplOf = G('flexChecklistTemplate');
      var nextOrder = function(){ return fr.sections.length ? Math.max.apply(null, fr.sections.map(function(x){ return x.order; })) + 1 : 0; };
      if(b.hasAttribute('data-flexcladd')){
        var p = b.getAttribute('data-flexcladd').split('|'), ri = parseInt(p[0],10);
        var inp = document.getElementById('flexClNew-' + ri), label = inp ? inp.value.trim() : '';
        if(!label){ toast('יש לרשום את שם הסעיף'); if(inp) inp.focus(); return; }
        var srcTpl = tplOf(fr.sections[ri]);
        var targets = p[1] === 'all' ? fr.sections.filter(function(x){ return isCl(x) && tplOf(x) === srcTpl; }) : [fr.sections[ri]];
        targets.forEach(function(sec){ if(!Array.isArray(sec.checklist)) sec.checklist = G('makeFlexChecklistFor')(sec); if(!sec.checklist.some(function(c){ return c.label === label; })) sec.checklist.push({ label: label, hasValue: false, value: '', status: '' }); });
        G('scheduleSave')(); G('render')(); toast(p[1] === 'all' ? 'הסעיף נוסף ל-' + targets.length + ' פרקים' : 'הסעיף נוסף');
        return;
      }
      if(b.hasAttribute('data-flexbulkpanels')){
        var type = (document.getElementById('flexBulkType') || {}).value || 'לוח חשמל';
        var names = String((document.getElementById('flexBulkNames') || {}).value || '').split('\n').map(function(x){ return x.trim(); }).filter(Boolean);
        var cnt = parseInt((document.getElementById('flexBulkCount') || {}).value, 10);
        if(!names.length && cnt > 0){ var existing = fr.sections.filter(function(x){ return x.type === type; }).length; for(var i = 1; i <= Math.min(cnt, 100); i++) names.push(type + ' ' + (existing + i)); }
        if(!names.length){ toast('יש לרשום שמות לוחות או מספר לוחות'); return; }
        var mk = G('makeFlexibleSection'), first = null;
        // הלוחות החדשים נכנסים לפני "עבודות שבוצעו / ממצאים / המלצות / סיכום" — אחרי הלוח האחרון הקיים
        var panels = fr.sections.filter(isPanel), insertAfter = panels.length ? Math.max.apply(null, panels.map(function(x){ return x.order; })) : -1;
        fr.sections.forEach(function(x){ if(x.order > insertAfter) x.order += names.length; });
        names.forEach(function(nm, k){ var sec = mk(type, insertAfter + 1 + k); sec.title = nm; fr.sections.push(sec); if(!first) first = sec; });
        G('scheduleSave')(); G('render')(); toast('נוספו ' + names.length + ' לוחות');
        return;
      }
      var di = parseInt(b.getAttribute('data-flexsecdup'), 10), src = fr.sections[di]; if(!src) return;
      var cp = JSON.parse(JSON.stringify(src));
      cp.id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
      cp.title = src.title + ' (עותק)'; cp.sectionPhotos = []; cp.items = cp.itemsMode ? [''] : []; cp.content = '';
      (cp.checklist || []).forEach(function(c){ c.status = ''; if(!c.hasValue) c.value = ''; });
      fr.sections.forEach(function(x){ if(x.order > src.order) x.order += 1; });
      cp.order = src.order + 1; fr.sections.push(cp);
      var os = G('openSections'); if(os) os.add('flex-sec-' + cp.id);
      G('scheduleSave')(); G('render')(); toast('שוכפל — הצ\'ק ליסט מוכן למילוי');
    });
    // ייבוא טופס 3 — קריאה, תצוגה לבדיקה, יצירת לוחות
    function form3ShowPreview(rows){
      window.__form3Rows = rows || [];
      var box = document.getElementById('form3Preview'); if(!box) return;
      if(!rows.length){ box.innerHTML = '<p class="sp-grp-hint" style="color:var(--bad);">לא זוהתה טבלת לוחות. ודא שיש שורת כותרות עם "שם הלוח" (ו"מיקום" / "גודל חיבור" / "גילוי"…).</p>'; return; }
      box.innerHTML = '<div class="sp-sub">נמצאו ' + rows.length + ' לוחות — בדוק וסמן מה ליצור:</div>' +
        '<div class="dc-table-wrap"><table class="dc-table dc-table-compact"><thead><tr><th style="width:40px;">✓</th><th>מיקום</th><th>שם הלוח</th><th>גודל חיבור</th><th>גילוי</th><th>ניתוק</th><th>כיבוי</th></tr></thead><tbody>' +
        rows.map(function(r, i){ return '<tr><td style="text-align:center;"><input type="checkbox" data-form3pick="' + i + '" checked style="width:20px;height:20px;"></td><td>' + esc(r.location) + '</td><td><b>' + esc(r.name) + '</b></td><td dir="ltr">' + esc(r.connection) + '</td><td>' + esc(r.detection) + '</td><td>' + esc(r.disconnect) + '</td><td>' + esc(r.extinguish) + '</td></tr>'; }).join('') +
        '</tbody></table></div><div class="sp-gen-actions"><button type="button" class="add-btn" data-form3create="1">צור את הלוחות שסומנו בדוח</button></div>';
    }
    app.addEventListener('change', function(e){
      var inp = e.target; if(!inp || !inp.matches || !inp.matches('input[type=file][data-form3file]')) return;
      e.stopPropagation();
      var f = inp.files && inp.files[0]; if(!f) return;
      var box = document.getElementById('form3Preview'); if(box) box.innerHTML = '<p class="sp-grp-hint">⏳ קורא את ' + esc(f.name) + '…</p>';
      G('form3ParseFile')(f).then(form3ShowPreview).catch(function(err){ if(box) box.innerHTML = '<p class="sp-grp-hint" style="color:var(--bad);">' + esc(err.message || 'קריאת הקובץ נכשלה') + '</p>'; });
    }, true);
    app.addEventListener('click', function(e){
      var sv = e.target.closest('button[data-form3saved], button[data-form3src]');
      if(sv){
        e.stopPropagation();
        if(sv.hasAttribute('data-form3src')){ form3ShowPreview((window.__form3Sources || [])[parseInt(sv.getAttribute('data-form3src'), 10)].rows || []); return; }
        var box0 = document.getElementById('form3Preview'); if(box0) box0.innerHTML = '<p class="sp-grp-hint">⏳ מחפש טפסי 3 שמורים…</p>';
        G('form3SavedSources')().then(function(list){
          window.__form3Sources = list;
          var bx = document.getElementById('form3Preview'); if(!bx) return;
          bx.innerHTML = list.length ? '<div class="sp-sub">בחר טופס 3:</div>' + list.map(function(x, i){ return '<button type="button" class="law-item" data-form3src="' + i + '"><b>' + esc(x.label) + '</b><span class="law-item-reg">' + x.rows.length + ' לוחות</span></button>'; }).join('')
            : '<p class="sp-grp-hint" style="color:var(--bad);">לא נמצאו טפסי 3 שמורים. אפשר להעלות קובץ (JSON / PDF / Excel) או להדביק טבלה.</p>';
        });
        return;
      }
      var b = e.target.closest('button[data-form3paste], button[data-form3create]'); if(!b) return;
      e.stopPropagation();
      if(b.hasAttribute('data-form3paste')){ form3ShowPreview(G('form3RowsFromText')((document.getElementById('form3Paste') || {}).value || '')); return; }
      var rows = (window.__form3Rows || []).filter(function(r, i){ var c = app.querySelector('input[data-form3pick="' + i + '"]'); return !c || c.checked; });
      if(!rows.length){ toast('לא סומנו לוחות'); return; }
      var n = G('form3CreatePanels')(rows); window.__form3Rows = [];
      G('scheduleSave')(); G('render')(); toast('נוצרו ' + n + ' לוחות מטופס 3');
    });
    // 📚 חוק החשמל — חיפוש, עיון, מועדפים, הפניה, פתיחת המקור, העלאה (מנהל)
    var lawSearchTimer = null;
    app.addEventListener('input', function(e){
      var t = e.target; if(!t || t.id !== 'lawSearch') return;
      clearTimeout(lawSearchTimer);
      lawSearchTimer = setTimeout(function(){
        var pos = t.selectionStart;
        G('lawSetState')('q', t.value); G('lawSetState')('sec', null); G('render')();
        var n = document.getElementById('lawSearch'); if(n){ n.focus(); try{ n.setSelectionRange(pos, pos); }catch(err){} }
      }, 220);
    });
    app.addEventListener('click', function(e){
      var b = e.target.closest('[data-lawreg],[data-lawopen],[data-lawback],[data-lawcite],[data-lawfav],[data-lawpdf],[data-lawpublish]'); if(!b) return;
      e.stopPropagation();
      var S = G('lawSetState'), card = function(){ var c = app.querySelector('section.card[data-key="toolbox-law"]'); if(c) c.scrollIntoView({ block: 'start' }); window.scrollBy(0, -10); };
      if(b.hasAttribute('data-lawreg')){ var ri = parseInt(b.getAttribute('data-lawreg'), 10); S('reg', G('lawOpenReg') === ri ? -1 : ri); G('render')(); return; }
      if(b.hasAttribute('data-lawopen')){ var p = b.getAttribute('data-lawopen').split('|'); S('sec', { ri: +p[0], si: +p[1] }); G('render')(); card(); return; }
      if(b.hasAttribute('data-lawback')){ S('sec', null); G('render')(); return; }
      if(b.hasAttribute('data-lawcite')){
        var q = b.getAttribute('data-lawcite').split('|'), d = G('lawGetDoc')(), reg = d.data.regs[+q[0]], sec = reg.sections[+q[1]];
        var txt = G('lawCitation')(reg, sec);
        (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function(){ toast('ההפניה הועתקה — הדבק בדוח'); }, function(){ window.prompt('העתק את ההפניה:', txt); });
        return;
      }
      if(b.hasAttribute('data-lawfav')){
        var key = b.getAttribute('data-lawfav'), f = G('lawFavs')(), i = f.indexOf(key);
        if(i >= 0) f.splice(i, 1); else f.unshift(key);
        G('lawSetFavs')(f); G('render')(); toast(i >= 0 ? 'הוסר מהמועדפים' : 'נוסף למועדפים'); return;
      }
      if(b.hasAttribute('data-lawpdf')){ G('lawOpenPdfPage')(parseInt(b.getAttribute('data-lawpdf'), 10)).catch(function(err){ toast(err.message || 'לא ניתן לפתוח את הקובץ'); }); return; }
      if(b.hasAttribute('data-lawpublish')){
        var pp = window.__lawParsed; if(!pp) return;
        var ver = (document.getElementById('lawVersionLabel') || {}).value || '';
        b.disabled = true; b.textContent = '⏳ מפרסם…';
        G('lawPublish')(pp.file, pp.parsed, ver).then(function(n){ window.__lawParsed = null; S('upload', { html: '<p class="sp-grp-hint" style="color:var(--ok);">✓ פורסם — ' + n + ' סעיפים זמינים לכל המשתמשים.</p>' }); G('render')(); toast('חוק החשמל פורסם'); })
          .catch(function(err){ b.disabled = false; b.textContent = 'פרסם לכל המשתמשים'; toast('הפרסום נכשל: ' + (err.message || err)); });
      }
    });
    app.addEventListener('change', function(e){
      var inp = e.target; if(!inp || !inp.matches || !inp.matches('input[type=file][data-lawupload]')) return;
      e.stopPropagation();
      var f = inp.files && inp.files[0]; if(!f) return;
      // תמיד מחפשים את התיבה מחדש — הטופס עלול להיבנות מחדש בזמן הפירוק (טעינה ברקע)
      var show = function(h){ G('lawSetState')('upload', { html: h }); var bx = document.getElementById('lawUploadStatus'); if(bx) bx.innerHTML = h; };
      show('<p class="sp-grp-hint">⏳ קורא את הקובץ…</p>');
      G('lawParseUpload')(f, function(pn, tot){ show('<p class="sp-grp-hint">⏳ מפרק עמוד ' + pn + ' מתוך ' + tot + '…</p>'); }).then(function(parsed){
        window.__lawParsed = { file: f, parsed: parsed };
        var regs = parsed.st.regs, tot = regs.reduce(function(a, r){ return a + r.sections.length; }, 0);
        show('<div class="sp-sub">סיכום הפירוק — בדוק לפני פרסום</div><p class="sp-grp-hint">' + parsed.pages + ' עמודים · ' + regs.length + ' תקנות · ' + tot + ' סעיפים</p>' +
          '<div class="dc-table-wrap"><table class="dc-table dc-table-compact"><thead><tr><th>תקנה</th><th style="width:70px;">עמוד</th><th style="width:80px;">סעיפים</th></tr></thead><tbody>' +
          regs.map(function(r){ return '<tr><td>' + esc(r.title) + '</td><td>' + r.page + '</td><td>' + r.sections.length + '</td></tr>'; }).join('') + '</tbody></table></div>' +
          '<div class="field"><label>תווית גרסה (לא חובה)</label><input type="text" id="lawVersionLabel" placeholder="למשל: עדכון אוקטובר 2026"></div>' +
          '<div class="sp-gen-actions"><button type="button" class="add-btn" data-lawpublish="1">פרסם לכל המשתמשים</button></div>');
      }).catch(function(err){ show('<p class="sp-grp-hint" style="color:var(--bad);">הקריאה נכשלה: ' + esc(err.message || err) + '</p>'); });
    }, true);
    // ===== טופס 3 (כבאות) =====
    var f3 = function(){ return G('getFireForm3')(); };
    var f3Rows2Panels = function(rows){ var fl = G('f3Flag'); return rows.map(function(r){ return { name: r.name || '', location: r.location || '', amperage: r.connection || '', detection: fl(r.detection), disconnect: fl(r.disconnect), extinguish: fl(r.extinguish) }; }); };
    var f3AddPanels = function(list, replace){
      var f = f3(); if(!list.length){ toast('לא זוהו לוחות'); return; }
      var cur = (f.panels || []).filter(function(p){ return p.name || p.location || p.amperage; });
      f.panels = replace ? list : cur.concat(list);
      G('scheduleSave')(); G('render')(); toast((replace ? 'הרשימה הוחלפה — ' : 'נוספו ') + list.length + ' לוחות');
    };
    app.addEventListener('click', function(e){
      var gs = e.target.closest('[data-f3gosettings]'); if(gs){ e.stopPropagation(); (0, eval)("activeTab = 'settings'"); G('render')(); window.scrollTo(0, 0); return; }
      var b = e.target.closest('[data-f3opt],[data-f3move],[data-f3panelspaste]'); if(!b || b.disabled) return;
      e.stopPropagation();
      var f = f3();
      if(b.hasAttribute('data-f3opt')){ var p = b.getAttribute('data-f3opt'), i = p.indexOf('|'); f[p.slice(0, i)] = p.slice(i + 1); G('scheduleSave')(); G('render')(); return; }
      if(b.hasAttribute('data-f3move')){ var q = b.getAttribute('data-f3move').split('|'), a = +q[0], d = +q[1], j = a + d; if(j < 0 || j >= f.panels.length) return; var t = f.panels[a]; f.panels[a] = f.panels[j]; f.panels[j] = t; G('scheduleSave')(); G('render')(); return; }
      var txt = (document.getElementById('f3PanelsPaste') || {}).value || '';
      f3AddPanels(f3Rows2Panels(G('form3RowsFromText')(txt)), b.getAttribute('data-f3panelspaste') === 'replace');
    });
    app.addEventListener('change', function(e){
      var el = e.target; if(!el || !el.matches) return;
      if(el.matches('select.f3-sel[data-textpath]')){
        e.stopPropagation();
        G('setDeep')(G('state'), el.getAttribute('data-textpath'), el.value);
        el.classList.remove('f3-yes', 'f3-no', 'f3-empty'); el.classList.add(el.value === 'קיים' ? 'f3-yes' : (el.value === 'לא קיים' ? 'f3-no' : 'f3-empty'));
        G('scheduleSave')(); return;
      }
      if(el.matches('select[data-f3colset]')){
        e.stopPropagation();
        var k = el.getAttribute('data-f3colset'), v = el.value; el.selectedIndex = 0; if(!v) return;
        f3().panels.forEach(function(p){ p[k] = v; }); G('scheduleSave')(); G('render')(); toast('סומן לכל הלוחות'); return;
      }
      if(el.matches('input[type=file][data-f3json]')){
        e.stopPropagation();
        var fj = el.files && el.files[0]; if(!fj) return;
        fj.text().then(function(t){ var obj = JSON.parse(t); var n = G('f3ImportJson')(obj); G('f3Remember')(); G('scheduleSave')(); G('render')(); toast('הטופס נטען — ' + n + ' לוחות'); })
          .catch(function(){ toast('קובץ JSON לא תקין'); });
        return;
      }
      if(el.matches('input[type=file][data-f3panelsfile]')){
        e.stopPropagation();
        var ff = el.files && el.files[0]; if(!ff) return;
        toast('קורא את הקובץ…');
        G('form3ParseFile')(ff).then(function(rows){ f3AddPanels(f3Rows2Panels(rows), false); }).catch(function(err){ toast(err.message || 'קריאת הקובץ נכשלה'); });
      }
    }, true);
    app.addEventListener('input', function(e){
      var t = e.target; if(!t || !t.getAttribute) return;
      var p = t.getAttribute('data-textpath') || '';
      if(/^fireForm3\.(inspector|licenseType)/.test(p)){ setTimeout(function(){ G('f3Remember')(); }, 0); }
    });
    // דוח קרקע — הצגת / הסתרת איור אופן ביצוע הבדיקה
    app.addEventListener('change', function(e){
      var c = e.target; if(!c || !c.matches || !c.matches('input[data-soilillus]')) return;
      e.stopPropagation();
      var st = G('state').soilTest; st.scope = st.scope || {}; st.scope.showIllustration = !!c.checked;
      G('scheduleSave')(); G('render')();
    }, true);
    // מזמין שהוקלד ידנית — שיוך אוטומטי ללקוח קיים בענן לפי שם (בלי ליצור לקוח חדש מכל הקלדה)
    app.addEventListener('change', function(e){
      var t = e.target; if(!t || !t.getAttribute || t.getAttribute('data-textpath') !== 'meta.client') return;
      var f = G('ensureCloudClientForReport'); if(typeof f !== 'function') return;
      setTimeout(function(){ f({ create: false }).then(function(id){ if(id) G('render')(); }); }, 0);
    });
    // דוח קוטביות סטרינגים: "הוסף מעגל" עם מספר עוקב לפי השורה האחרונה (מחושב ברגע הלחיצה)
    app.addEventListener('click', function(e){
      var b = e.target.closest('button[data-spaddcircuit]');
      if(!b) return;
      e.stopPropagation();
      var st = G('state'), getDeep = G('getDeep'), mk = G('makeStringPolarityCircuit'), nx = G('nextStringCircuitNumber');
      if(!st || typeof getDeep !== 'function') return;
      var arr = getDeep(st, b.getAttribute('data-spaddcircuit'));
      if(!Array.isArray(arr)) return;
      var last = arr[arr.length - 1] || {};
      var row = mk('', last.insulationUnit || (st.stringPolarityReport && st.stringPolarityReport.insulationUnit) || 'MΩ');
      row.circuit = arr.length ? nx(last.circuit) : '1';
      arr.push(row);
      G('scheduleSave')(); G('render')();
      setTimeout(function(){
        var inp = document.querySelector('input[data-textpath="' + b.getAttribute('data-spaddcircuit') + '.' + (arr.length - 1) + '.voltage"]');
        if(inp){ inp.scrollIntoView({block:'center'}); }
      }, 50);
    });
    // דוח קוטביות סטרינגים: "קוטביות תקינה לכל המעגלים שנמדדו ועוד לא סומנו" (יש מתח או בידוד)
    app.addEventListener('click', function(e){
      var b = e.target.closest('button[data-spbulk]');
      if(!b) return;
      e.stopPropagation();
      var st = G('state'), getDeep = G('getDeep');
      if(!st || typeof getDeep !== 'function') return;
      var arr = getDeep(st, b.getAttribute('data-spbulk')) || [], n = 0;
      arr.forEach(function(c){ if(!c.polarity && (String(c.voltage||'').trim() || String(c.insulation||'').trim())){ c.polarity = 'ok'; n++; } });
      G('scheduleSave')(); G('render')();
      toast(n ? n + ' מעגלים סומנו קוטביות תקינה' : 'אין מעגלים פתוחים לסימון');
    });
    // התוספות לטופס רצות מיד אחרי כל render (לפני ציור המסך — בלי הבהוב); התפריט מתעדכן בהשהיה קצרה
    new MutationObserver(function(){ enhance(); schedule(); }).observe(app, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    var scrollT = null;
    window.addEventListener('scroll', function(){ headerOffset(); if(!scrollT) scrollT = setTimeout(function(){ scrollT = null; markActive(); }, 100); }, { passive: true });
    window.addEventListener('resize', schedule);
    initTheme();
    initBrand();
    initSavePill();
    setInterval(updateLogo, 5000);
    enhance();
    schedule();
  }
  /* ---------------- נגד קפיצות: שמירת מיקום הגלילה בכל render() ----------------
     render() מחליף את כל תוכן הטופס. אם באותו רגע הדף קצר יותר (תמונות שעוד לא נטענו), הדפדפן
     "מושך" את המסך למעלה. שומרים את מיקום הגלילה ואת גובה הדף רגע לפני, ומחזירים מיד אחרי.
     גלילה מכוונת (מעבר לסעיף מהתפריט) קורית אחרי render ב-setTimeout — לא מושפעת. */
  (function wrapRender(){
    var orig = window.render;
    if(typeof orig !== 'function' || orig.__rdWrapped) return;
    var releaseT = null;
    var wrapped = function(){
      var app2 = document.getElementById('app');
      var y = window.pageYOffset;
      if(app2){ app2.style.minHeight = app2.offsetHeight + 'px'; }
      // גם גלילה אופקית בתוך טבלאות רחבות (dc-table-wrap) נשמרת — אחרת הטבלה "חוזרת להתחלה"
      var wraps = app2 ? Array.prototype.map.call(app2.querySelectorAll('.dc-table-wrap'), function(w){ return w.scrollLeft; }) : [];
      var r = orig.apply(this, arguments);
      if(Math.abs(window.pageYOffset - y) > 1) window.scrollTo(0, y);
      if(app2 && wraps.length){
        var now = app2.querySelectorAll('.dc-table-wrap');
        if(now.length === wraps.length) Array.prototype.forEach.call(now, function(w, i){ if(wraps[i]) w.scrollLeft = wraps[i]; });
      }
      clearTimeout(releaseT);
      releaseT = setTimeout(function(){ if(app2) app2.style.minHeight = ''; }, 700);
      return r;
    };
    wrapped.__rdWrapped = true;
    window.render = wrapped;
  })();

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
