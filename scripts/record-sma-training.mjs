/**
 * scripts/record-sma-training.mjs
 *
 * סרטון הדרכה לדוח תחזוקה SMA. מקליט את הדפדפן באמת (Playwright video),
 * עם כתוביות עברית צרובות על המסך. לא משנה את האפליקציה.
 *
 * לפני ההרצה:
 *   VITE_OFFLINE_DEMO=1 npm run dev -- --host 127.0.0.1 --port 5173
 *   npm install --no-save playwright-core
 *
 * הרצה (מתוך שורש הריפו):
 *   NODE_PATH=/tmp/node_modules node scripts/record-sma-training.mjs
 *
 * Chrome: CHROME_PATH (ברירת מחדל /usr/bin/google-chrome)
 * כתובת:  SMA_URL (ברירת מחדל http://127.0.0.1:5173/app/)
 * פלט:    OUT (ברירת מחדל /opt/cursor/artifacts/sma-training.mp4 אם התיקייה קיימת)
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

async function loadChromium() {
  try {
    return (await import('playwright-core')).chromium;
  } catch {
    // הרצה בלי תלות ב-package.json של האפליקציה
    const require = createRequire('/tmp/package.json');
    return require('playwright-core').chromium;
  }
}

const chromium = await loadChromium();

const URL = process.env.SMA_URL || 'http://127.0.0.1:5173/app/';
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const OUT = process.env.OUT || '/opt/cursor/artifacts/sma-training.mp4';
const WIDTH = 412;
const HEIGHT = 915;

const TITLE = 'הדרכה: דוח תחזוקה – טיפול בממירי SMA';
const END_TITLE = 'סיום ההדרכה';
const END_SUB = 'הדוח מוכן לתצוגה מקדימה\nולשמירה כ־PDF.\nבודקים בשטח — שקד הנדסת חשמל.';

const PACE = Number(process.env.PACE || 2.3);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, Math.round(ms * PACE)));
}

/** מוצא את כרטיס התחנה לפי הכותרת המדויקת (לא תא מקונן). */
const FIND_STATION = `function station(code) {
  for (const card of document.querySelectorAll('.sh-facility')) {
    const head = card.querySelector(':scope > .sh-facility__head .sh-facility__title');
    if (head && head.textContent.trim() === code) return card;
  }
  return null;
}`;

async function installChromeHooks(page) {
  await page.addInitScript(() => {
    window.confirm = () => true;
    window.alert = () => {};
    window.__printed = false;
    window.print = () => { window.__printed = true; };
  });
}

async function ensureOverlay(page) {
  await page.evaluate(() => {
    if (document.getElementById('sma-train-style')) return;
    const style = document.createElement('style');
    style.id = 'sma-train-style';
    style.textContent = `
      #sma-cap, #sma-card {
        font-family: Heebo, "Noto Serif Hebrew", "Noto Sans Hebrew", sans-serif;
        direction: rtl;
      }
      #sma-cap {
        position: fixed; z-index: 80; left: 10px; right: 10px; bottom: 102px;
        background: #0F2E4D; color: #fff; border-radius: 16px;
        padding: 12px 16px; font-size: 22px; font-weight: 800; line-height: 1.35;
        text-align: right; box-shadow: 0 8px 24px rgba(0,0,0,.28);
        pointer-events: none;
      }
      #sma-card {
        position: fixed; inset: 0; z-index: 400; background: #0F2E4D; color: #fff;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        text-align: center; padding: 28px; gap: 18px;
      }
      #sma-card h1 { margin: 0; font-size: 30px; font-weight: 800; line-height: 1.35; }
      #sma-card p { margin: 0; font-size: 20px; font-weight: 600; line-height: 1.45; white-space: pre-line; opacity: .95; }
    `;
    document.head.appendChild(style);
  });
}

async function caption(page, text) {
  await ensureOverlay(page);
  await page.evaluate((text) => {
    document.getElementById('sma-card')?.remove();
    let el = document.getElementById('sma-cap');
    if (!el) {
      el = document.createElement('div');
      el.id = 'sma-cap';
      document.body.appendChild(el);
    }
    el.textContent = text;
  }, text);
  await sleep(550);
}

async function card(page, title, sub) {
  await ensureOverlay(page);
  await page.evaluate(({ title, sub }) => {
    document.getElementById('sma-cap')?.remove();
    let el = document.getElementById('sma-card');
    if (!el) {
      el = document.createElement('div');
      el.id = 'sma-card';
      document.body.appendChild(el);
    }
    el.replaceChildren();
    const h = document.createElement('h1');
    h.textContent = title;
    el.appendChild(h);
    if (sub) {
      const p = document.createElement('p');
      p.textContent = sub;
      el.appendChild(p);
    }
  }, { title, sub });
}

async function hideCard(page) {
  await page.evaluate(() => document.getElementById('sma-card')?.remove());
}

async function clickButton(page, includes) {
  const ok = await page.evaluate((needle) => {
    const btn = [...document.querySelectorAll('button')].find((b) => !b.disabled && ((b.getAttribute('aria-label') || '').includes(needle) || b.textContent.includes(needle)));
    if (!btn) return false;
    btn.scrollIntoView({ block: 'center' });
    btn.click();
    return true;
  }, includes);
  if (!ok) throw new Error('לא נמצא כפתור: ' + includes);
}

async function scrollStation(page, code) {
  const ok = await page.evaluate(new Function('code', `${FIND_STATION}
    const card = station(code);
    if (!card) return false;
    (card.querySelector(':scope > .sh-facility__head') || card).scrollIntoView({ block: 'center' });
    return true;
  `), code);
  if (!ok) throw new Error('תחנה לא נמצאה: ' + code);
  await sleep(450);
}

async function clickInStation(page, code, needle) {
  const find = new Function('opts', `${FIND_STATION}
    const card = station(opts.code);
    if (!card) return false;
    const btn = [...card.querySelectorAll(':scope > .sh-facility__head button, :scope > .sh-facility__body button')].find((b) =>
      (b.getAttribute('aria-label') || '').includes(opts.needle) || b.textContent.includes(opts.needle));
    if (!btn) return false;
    if (!opts.click) btn.scrollIntoView({ block: 'center' });
    else btn.click();
    return true;
  `);
  if (!await page.evaluate(find, { code, needle, click: false })) throw new Error(`כפתור "${needle}" לא נמצא ב-${code}`);
  await sleep(650);
  await page.evaluate(find, { code, needle, click: true });
}

/** ממקד שדה לפי טקסט התווית. code = תחנה, או null לכל הדף. last = המופע האחרון. */
async function focusField(page, { code, label, last = false, ariaIncludes }) {
  const ok = await page.evaluate(new Function('opts', `${FIND_STATION}
    const root = opts.code ? station(opts.code) : document;
    if (!root) return false;
    let input = null;
    if (opts.ariaIncludes) {
      const all = [...root.querySelectorAll('input, textarea, select')].filter((el) =>
        (el.getAttribute('aria-label') || '').includes(opts.ariaIncludes));
      input = opts.last ? all[all.length - 1] : all[0];
    } else {
      const labels = [...root.querySelectorAll('label')].filter((l) => l.textContent.trim() === opts.label);
      const lab = opts.last ? labels[labels.length - 1] : labels[0];
      if (!lab) return false;
      input = (lab.htmlFor && document.getElementById(lab.htmlFor)) || lab.querySelector('input, textarea, select');
    }
    if (!input) return false;
    input.scrollIntoView({ block: 'center' });
    input.focus();
    return true;
  `), { code, label, last, ariaIncludes });
  if (!ok) throw new Error(`שדה לא נמצא: ${label || ariaIncludes} (${code || 'דף'})`);
  await sleep(250);
}

async function replaceText(page, opts, text, delay = 42) {
  await focusField(page, opts);
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.type(text, { delay });
  await sleep(300);
}

async function setStatus(page, code, itemIncludes, status) {
  const find = new Function('opts', `${FIND_STATION}
    const card = station(opts.code);
    if (!card) return false;
    const row = [...card.querySelectorAll(':scope > .sh-facility__body .sh-row')].find((r) =>
      (r.querySelector('.sh-row__label')?.textContent || '').includes(opts.itemIncludes));
    if (!row) return false;
    const btn = [...row.querySelectorAll('button')].find((b) => b.textContent.trim() === opts.status);
    if (!btn) return false;
    if (!opts.click) row.scrollIntoView({ block: 'center' });
    else btn.click();
    return true;
  `);
  const opts = { code, itemIncludes, status };
  if (!await page.evaluate(find, { ...opts, click: false })) throw new Error(`סטטוס ${status} לפריט ${itemIncludes} ב-${code}`);
  await sleep(550);
  await page.evaluate(find, { ...opts, click: true });
}

async function noteInRow(page, code, itemIncludes, text) {
  const ok = await page.evaluate(new Function('opts', `${FIND_STATION}
    const card = station(opts.code);
    const row = [...card.querySelectorAll(':scope > .sh-facility__body .sh-row')].find((r) =>
      (r.querySelector('.sh-row__label')?.textContent || '').includes(opts.itemIncludes));
    const input = row?.querySelector('input[aria-label^="הערה"]');
    if (!input) return false;
    input.scrollIntoView({ block: 'center' });
    input.focus();
    return true;
  `), { code, itemIncludes });
  if (!ok) throw new Error('הערה לא נמצאה: ' + itemIncludes);
  await sleep(200);
  await page.keyboard.type(text, { delay: 40 });
  await sleep(300);
}

async function clickMarkRest(page, code, which) {
  // which: 0 לוח, 1 שנאי, 2 ניקיון
  const ok = await page.evaluate(new Function('opts', `${FIND_STATION}
    const card = station(opts.code);
    const buttons = [...card.querySelectorAll(':scope > .sh-facility__body button')].filter((b) => b.textContent.includes('טרם נבדק'));
    const btn = buttons[opts.which];
    if (!btn) return false;
    btn.scrollIntoView({ block: 'center' });
    btn.click();
    return true;
  `), { code, which });
  if (!ok) throw new Error('כפתור סימון תקין לא נמצא #' + which);
}

async function main() {
  mkdirSync(dirname(OUT), { recursive: true });
  const videoDir = join(tmpdir(), 'sma-train-' + Date.now());
  mkdirSync(videoDir, { recursive: true });

  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--lang=he-IL'],
  });
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    locale: 'he-IL',
    recordVideo: { dir: videoDir, size: { width: WIDTH, height: HEIGHT } },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  await installChromeHooks(page);

  let step = 'פתיחה';
  try {
    step = 'טעינת האפליקציה';
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await card(page, TITLE, 'לבודקים בשטח\nמצב הדגמה — בלי חיבור לענן');
    await sleep(2400);

    step = 'בחירת סוג הדוח';
    await hideCard(page);
    await caption(page, 'פותחים את האפליקציה ובוחרים «טיפול בממירי SMA».');
    await sleep(2200);
    await page.evaluate(() => {
      const cardEl = [...document.querySelectorAll('.sh-type-card')].find((el) => el.textContent.includes('טיפול בממירי SMA'));
      cardEl?.scrollIntoView({ block: 'center' });
    });
    await sleep(800);
    await caption(page, 'לוחצים «הדגמה». נפתח דוח לדוגמה, והוא לא נשמר בענן.');
    await sleep(1600);
    await page.evaluate(() => {
      const cardEl = [...document.querySelectorAll('.sh-type-card')].find((el) => el.textContent.includes('טיפול בממירי SMA'));
      [...cardEl.querySelectorAll('button')].find((b) => b.textContent.includes('הדגמה')).click();
    });
    await page.waitForFunction(() => document.body.innerText.includes('SMA-1099-09-2026'));
    await caption(page, 'זה דוח התחזוקה. קודם ממלאים את פרטי השער.');
    await sleep(2000);

    step = 'מזמין הבדיקה';
    await caption(page, 'ממלאים את מזמין הבדיקה.');
    await replaceText(page, { label: 'מזמין הבדיקה' }, 'אלמור אנרגיות מתחדשות', 38);
    await sleep(700);

    step = 'שם המתקן';
    await caption(page, 'ממלאים את שם המתקן ואת המיקום.');
    await replaceText(page, { label: 'שם המתקן' }, 'ניר יצחק', 55);
    await sleep(400);
    await replaceText(page, { label: 'מיקום המתקן' }, 'קיבוץ ניר יצחק', 40);
    await sleep(800);

    step = 'SONEL';
    await caption(page, 'מסמנים את מכשיר SONEL. הוא יופיע בשער עם מספר סידורי ותוקף כיול.');
    await page.evaluate(() => {
      const box = [...document.querySelectorAll('label.sh-check')].find((l) => l.textContent.includes('SONEL'));
      box?.scrollIntoView({ block: 'center' });
    });
    await sleep(700);
    const sonel = page.locator('label.sh-check', { hasText: 'SONEL' }).locator('input');
    await sonel.click();
    await sleep(900);
    await sonel.click();
    await sleep(1200);

    step = 'בודק';
    await caption(page, 'שם הבודק ומספר הרישיון מגיעים מהגדרות החברה, ומופיעים בעמוד השער.');
    await sleep(2800);

    step = 'שכפול תחנה';
    await caption(page, 'כל שנאי הוא תחנה: TR1, TR2… שכפול מעתיק תחנה שלמה.');
    await scrollStation(page, 'TR1');
    await sleep(900);
    await clickInStation(page, 'TR1', 'שכפל');
    await sleep(1400);

    step = 'הוספת תחנה';
    await caption(page, 'אפשר גם להוסיף תחנה ריקה. נוסיף אחת ונמלא אותה.');
    await sleep(1200);
    await clickButton(page, 'הוסף תחנה');
    await sleep(800);
    await page.evaluate(() => {
      for (const b of document.querySelectorAll('button')) if (b.textContent.includes('צמצם')) b.click();
    });
    await sleep(400);
    await scrollStation(page, 'TR4');
    await clickInStation(page, 'TR4', 'הרחב');
    await sleep(800);

    step = 'בדיקת לוח';
    await caption(page, 'בלוח מסמנים תקין, לא תקין, או לא רלוונטי.');
    await setStatus(page, 'TR4', '1. בדיקה ויזואלית', 'תקין');
    await sleep(700);
    await setStatus(page, 'TR4', 'אטימות של התא', 'לא רלוונטי');
    await sleep(800);
    await caption(page, '«לא תקין» תמיד עם הערה — כאן בורג רופף בחיזוק הלוח.');
    await setStatus(page, 'TR4', 'בדיקת חיזוק הלוח לקרקע', 'לא תקין');
    await sleep(400);
    await noteInRow(page, 'TR4', 'בדיקת חיזוק הלוח לקרקע', 'בורג רופף');
    await sleep(800);
    await caption(page, 'את השאר מסמנים «תקין» בלחיצה אחת, רק מה שעוד לא נבדק.');
    await clickMarkRest(page, 'TR4', 0);
    await sleep(1400);

    step = 'תא מתח גבוה';
    await caption(page, 'מוסיפים תא מתח גבוה: סוג התא, השם והיצרן.');
    await clickInStation(page, 'TR4', 'הוסף תא');
    await sleep(700);
    await replaceText(page, { code: 'TR4', label: 'סוג תא', last: true }, 'תא כניסה', 40);
    await replaceText(page, { code: 'TR4', label: 'שם התא', last: true }, 'הזנה לשנאי TR4', 35);
    await replaceText(page, { code: 'TR4', label: 'יצרן', last: true }, 'Siemens', 45);
    await sleep(700);

    step = 'שנאי';
    await caption(page, 'ממלאים את נתוני השנאי: תוצרת, מספר יצרן, הספק ומתח.');
    await replaceText(page, { code: 'TR4', label: 'תוצרת' }, 'SBG', 70);
    await replaceText(page, { code: 'TR4', label: 'מס\' יצרן' }, '2825200', 50);
    await replaceText(page, { code: 'TR4', label: 'הספק (kVA)' }, '4000', 60);
    await replaceText(page, { code: 'TR4', label: 'מתח נומינלי (kV)' }, '22kV/600V', 40);
    await sleep(500);
    await caption(page, 'ומסמנים את הבדיקה הוויזואלית הקצרה של השנאי.');
    await clickMarkRest(page, 'TR4', 1);
    await sleep(1200);

    step = 'ניקיון ממיר';
    await caption(page, 'ניקיון ממיר SMA: קבלים, מפוח, סליל, מסננים ותעלות.');
    await clickMarkRest(page, 'TR4', 2);
    await sleep(1600);

    step = 'בידוד';
    await caption(page, 'בדיקת בידוד DAR: מזינים את ההתנגדות אחרי 60 שניות.');
    await focusField(page, { code: 'TR4', ariaIncludes: '60' });
    await page.keyboard.type('2.5', { delay: 120 });
    await sleep(400);
    const unit = page.locator('select[aria-label="מתח גבוה להארקה — יחידה"]');
    await unit.scrollIntoViewIfNeeded();
    await unit.selectOption('GΩ');
    await sleep(1600);

    step = 'ציוד בטיחות';
    await caption(page, 'ציוד בטיחות למתח גבוה. «לא תקין» בלי הערה מזהיר לפני ההפקה.');
    await page.evaluate(() => {
      const head = [...document.querySelectorAll('h2')].find((h) => h.textContent.includes('ציוד בטיחות'));
      head?.scrollIntoView({ block: 'start' });
    });
    await sleep(1600);

    step = 'הערות';
    await caption(page, 'כותבים הערה חופשית. היא ממוספרת בסוף הדוח.');
    await page.evaluate(() => {
      const cardEl = [...document.querySelectorAll('.sh-card')].find((c) => c.querySelector('.sh-card__title')?.textContent.trim() === 'הערות');
      const btn = [...cardEl.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'הוסף הערה');
      btn.scrollIntoView({ block: 'center' });
      btn.click();
    });
    await sleep(500);
    await page.evaluate(() => {
      const cardEl = [...document.querySelectorAll('.sh-card')].find((c) => c.querySelector('.sh-card__title')?.textContent.trim() === 'הערות');
      const areas = [...cardEl.querySelectorAll('textarea')];
      const last = areas[areas.length - 1];
      last.scrollIntoView({ block: 'center' });
      last.focus();
    });
    await sleep(250);
    await page.keyboard.type('נדרש מעקב אחרי גז SF6 בתחנה TR4', { delay: 38 });
    await sleep(900);

    step = 'תמונה';
    await caption(page, 'מוסיפים תמונה מהגלריה, ונותנים לה כותרת. ההערות ממוספרות 1.1, 1.2.');
    const photo = join(tmpdir(), 'sma-train-photo.png');
    const shot = spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=0x1B4F72:s=800x600', '-frames:v', '1', photo], { stdio: 'ignore' });
    if (shot.status !== 0) throw new Error('יצירת תמונת הדגמה נכשלה');
    const before = await page.locator('input[aria-label^="כותרת תמונה"]').count();
    await page.locator('input[aria-label="הוסף תמונות מהגלריה"]').setInputFiles(photo);
    await page.waitForFunction((n) => document.querySelectorAll('input[aria-label^="כותרת תמונה"]').length > n, before);
    await sleep(600);
    await focusField(page, { ariaIncludes: 'כותרת תמונה', last: true });
    await page.keyboard.type('לוח TR4', { delay: 70 });
    await sleep(1200);

    step = 'תצוגה מקדימה';
    await caption(page, 'תצוגה מקדימה: כך ייראה הדוח המודפס.');
    await sleep(1200);
    await clickButton(page, 'מקדימה');
    await page.waitForSelector('.sh-doc');
    await sleep(800);
    await caption(page, 'עמוד השער: מזמין, אתר, ומספר הדוח.');
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(2200);
    await caption(page, 'מבצע הבדיקה, מספר הרישיון, ומכשיר SONEL.');
    await page.evaluate(() => {
      const row = [...document.querySelectorAll('.sh-cover__table th')].find((th) => th.textContent.includes('מבצע הבדיקה'));
      row?.scrollIntoView({ block: 'center' });
    });
    await sleep(2400);
    await caption(page, 'הבדיקה הוויזואלית של הלוח, בשני טורים כמו בדוח.');
    await page.evaluate(() => {
      const h = [...document.querySelectorAll('h2')].find((el) => el.textContent.includes('בדיקה ויזואלית — לוח — TR4'));
      h?.scrollIntoView({ block: 'center' });
    });
    await sleep(2400);
    await caption(page, 'בדיקת הבידוד: 2.5 ג׳יגה־אוהם אחרי 60 שניות.');
    await page.evaluate(() => {
      const h = [...document.querySelectorAll('h2')].find((el) => el.textContent.includes('בדיקת בידוד — שנאי — TR4'));
      h?.scrollIntoView({ block: 'center' });
    });
    await sleep(2200);

    step = 'הדפסה';
    await caption(page, 'לוחצים הדפסה / PDF. בטלפון נפתח חלון השמירה כ-PDF.');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(600);
    await clickButton(page, 'PDF');
    await page.waitForFunction(() => window.__printed === true);
    await sleep(800);
    await page.emulateMedia({ media: 'print' });
    await caption(page, 'כך נראה הדוח בעמוד ההדפסה, מוכן לשמירה כ-PDF.');
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(2800);
    await page.emulateMedia({ media: 'screen' });

    step = 'סיום';
    await card(page, END_TITLE, END_SUB);
    await sleep(2600);
    step = 'סיום-הושלם';
  } catch (err) {
    console.error('נכשל בשלב:', step);
    console.error(err);
    try {
      await page.screenshot({ path: join(tmpdir(), 'sma-train-fail.png'), fullPage: false });
      console.error('צילום תקלה:', join(tmpdir(), 'sma-train-fail.png'));
    } catch { /* הדף אולי סגור */ }
    throw err;
  } finally {
    const video = page.video();
    await context.close();
    await browser.close();
    if (step !== 'סיום-הושלם') return;
    const webm = video ? await video.path() : '';
    if (!webm) throw new Error('אין קובץ וידאו');
    console.log('webm', webm);
    const enc = spawnSync('ffmpeg', [
      '-y', '-i', webm,
      '-vf', 'fps=15,scale=824:1830:flags=lanczos',
      '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
      '-crf', '24', '-preset', 'medium', '-an', '-movflags', '+faststart',
      OUT,
    ], { stdio: 'inherit' });
    if (enc.status !== 0) process.exit(enc.status || 1);
    const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size', '-of', 'default=nw=1', OUT], { encoding: 'utf8' });
    console.log(probe.stdout);
    writeFileSync(join(videoDir, 'done.txt'), OUT);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
