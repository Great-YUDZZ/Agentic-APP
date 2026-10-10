import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
    proxy: {
      '/api/proxy': {
        target: 'http://localhost:20128/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/proxy/, ''),
      },
    },
  },
});
