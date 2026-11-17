/**
 * src/config.ts — הגדרות חיבור.
 *
 * ברירת המחדל = אותו פרויקט Supabase ואותו מפתח ציבורי (anon) שהאפליקציה הקיימת משתמשת בהם
 * (state.settings.supabaseUrl / supabaseAnonKey ב-js/app.js). המפתח הזה ציבורי מעצם הגדרתו
 * (role: anon) וכבר מופיע בקוד של האפליקציה החיה; ההרשאות נאכפות ב-RLS בשרת.
 * משתני סביבה (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) גוברים — למשל לפרויקט בדיקות.
 * לעולם לא לשים כאן מפתח service_role.
 */
const DEFAULT_SUPABASE_URL = 'https://mbpiifsoeamdqntlzdgu.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1icGlpZnNvZWFtZHFudGx6ZGd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MTMyODgsImV4cCI6MjEwMjE4OTI4OH0.KpD7gvzn5p59wofCtrrXsrDk3F4djYq7VNojV5wJyi4';

export const SUPABASE_URL: string = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || DEFAULT_SUPABASE_URL;
export const SUPABASE_ANON_KEY: string = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || DEFAULT_SUPABASE_ANON_KEY;

/** "מצב הדגמה בלבד" — בלי ענן (למשל לבדיקות): VITE_OFFLINE_DEMO=1 */
export const OFFLINE_DEMO: boolean = import.meta.env.VITE_OFFLINE_DEMO === '1';

export const APP_VERSION = '3.0.0-preview';

/** כתובת האפליקציה הקיימת (פרויקט shked ב-Vercel). ב-Preview זה דומיין אחר — לכן כתובת מלאה. */
export const LEGACY_APP_URL: string = (import.meta.env.VITE_LEGACY_APP_URL as string | undefined) || 'https://shked.vercel.app/';
