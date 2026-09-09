import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * In dev, Vite is the reverse proxy in front of Realx8-Core: the app calls the
 * relative base `/api`, and everything under it (plus `/uploads`, which
 * user-service serves) is forwarded to the backend. That keeps the browser
 * same-origin locally, exactly as nginx or Vercel does in production, so CORS
 * behaves the same in both.
 *
 * DEV_API_TARGET points at whatever is serving the API:
 *   http://localhost:3000   Realx8-Core (`npm start`) — the default
 *   http://localhost:3000   the api-gateway, if you run the fully split shape
 *   http://localhost:3002   one service directly, when debugging just that one
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.DEV_API_TARGET || 'http://localhost:3000';

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      allowedHosts: true,
      proxy: {
        // Realx8-Core serves every route at both /api/x and /x, so stripping
        // the prefix is optional for it — but it also lets you point
        // DEV_API_TARGET straight at a single service, which only knows /x.
        '/api': {
          target,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
        '/uploads': {
          target,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production',
    },
  };
});
