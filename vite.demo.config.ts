/**
 * Vite config for building the demo app (GitHub Pages).
 *
 * Unlike the library build (vite.config.ts), this produces a standalone
 * single-page application with index.html as entry point.
 *
 * Usage:  npx vite build --config vite.demo.config.ts
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [tailwindcss(), react()],
  base: '/datavis/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@core': path.resolve(__dirname, './wcdatavis/src'),
    },
  },
  build: {
    outDir: 'dist-demo',
  },
});
