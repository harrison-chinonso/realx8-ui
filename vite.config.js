import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

/**
 * Fails the build when index.html's inline theme script no longer matches the
 * hash vercel.json's CSP allows. Without this, editing the script silently
 * gets it blocked in production — the page still works, it just goes back to
 * flashing the default colours on every load, which nobody would trace here.
 */
const inlineScriptHashGuard = () => ({
  name: 'inline-script-hash-guard',
  apply: 'build',
  transformIndexHtml(html) {
    const csp = readFileSync(new URL('./vercel.json', import.meta.url), 'utf8');
    for (const [, body] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
      const hash = createHash('sha256').update(body).digest('base64');
      if (!csp.includes(`'sha256-${hash}'`)) {
        throw new Error(`index.html inline script changed: add 'sha256-${hash}' to script-src in vercel.json`);
      }
    }
    return html;
  },
});

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
    plugins: [react(), inlineScriptHashGuard()],
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
