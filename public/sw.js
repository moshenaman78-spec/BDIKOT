/*
 * Service Worker — Shaked Test Reports (/app/)
 * - מעטפת האפליקציה זמינה גם בלי רשת (ניווט: רשת קודם, ובלי רשת — index.html מהמטמון).
 * - קבצי build (/app/assets/*, עם hash בשם) — מהמטמון קודם; משתנים רק בפריסה חדשה.
 * - בקשות לענן (Supabase) ובקשות שאינן GET — לא נוגעים בהן בכלל (לא נשמרות במטמון).
 */
const VERSION = 'v3.0.0-preview-1';
const SHELL = `shell-${VERSION}`;
const ASSETS = `assets-${VERSION}`;
const BASE = '/app/';
const PRECACHE = [BASE, `${BASE}manifest.webmanifest`, `${BASE}icons/icon-192.png`, `${BASE}icons/icon-512.png`];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== ASSETS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => { if (res.ok) { const copy = res.clone(); caches.open(SHELL).then((c) => c.put(BASE, copy)); } return res; })
        .catch(() => caches.match(BASE).then((r) => r || Response.error())),
    );
    return;
  }

  if (url.pathname.startsWith(`${BASE}assets/`) || url.pathname.startsWith(`${BASE}icons/`)) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(ASSETS).then((c) => c.put(req, copy)); }
        return res;
      })),
    );
  }
});
