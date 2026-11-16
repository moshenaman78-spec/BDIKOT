/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// האפליקציה הקיימת (2.2.x) נשארת ב-/ ; האפליקציה החדשה מוגשת תחת /app/
export default defineConfig({
  base: '/app/',
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: { outDir: 'dist/app', emptyOutDir: true },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
