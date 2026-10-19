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
  build: {
    lib: {
      // `chat` is its own entry: it pulls in SuperChat and its Markdown peers.
      entry: {
        'datavis-react': path.resolve(__dirname, 'src/index.ts'),
        chat: path.resolve(__dirname, 'src/chat.ts'),
      },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`,
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
