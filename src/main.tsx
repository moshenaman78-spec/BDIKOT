import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { cssVariables } from './styles/tokens';
import './styles/theme.css';
import './styles/print.css';

const style = document.createElement('style');
style.textContent = cssVariables();
document.head.prepend(style);

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

// PWA — רק ב-build (לא בפיתוח, כדי שלא יוגש קוד ישן מהמטמון)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => {
      // בלי Service Worker האפליקציה עובדת רגיל — רק בלי התקנה ובלי מעטפת לא-מקוונת
    });
  });
}
