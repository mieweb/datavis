import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [tailwindcss(), react()],
  test: {
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // a3t ships CommonJS bundles via a symlinked `file:` dependency; pre-bundle
  // its browser entries so Vite provides the default-export interop they need.
  optimizeDeps: {
    include: ['a3t/browser', 'a3t/minimongo', 'minimongo'],
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'datavis-react',
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'datavis-ace',
        'i18next',
        'react-i18next',
        'recharts',
        /^recharts\//,
        'use-sync-external-store',
        /^use-sync-external-store\//,
        'lucide-react',
        /^@mieweb\/ui/,
      ],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
  },
});
