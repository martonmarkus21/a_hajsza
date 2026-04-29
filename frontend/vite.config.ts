import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiOrigin = (env.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const wsOrigin = (() => {
    try {
      const u = new URL(apiOrigin);
      u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
      return u.origin;
    } catch {
      return apiOrigin.replace(/^https:\/\//i, 'wss://').replace(/^http:\/\//i, 'ws://');
    }
  })();

  return {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    plugins: [react()],
    server: {
      port: 3001,
      host: true,
      strictPort: false,
      proxy: {
        '/api': {
          target: apiOrigin,
          changeOrigin: true,
        },
        '/ws': {
          target: wsOrigin,
          ws: true,
        },
      },
    },
    build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            leaflet: ['leaflet', 'react-leaflet'],
            icons: ['react-icons', 'lucide-react'],
          },
        },
      },
    },
  };
});


