# Realx8-Ui

The Realx8 web app — React + Vite + Tailwind. Deployed independently of the
backend, which lives in [`Realx8-Core`](../Realx8-Core).

```bash
cp .env.example .env
npm install
npm run dev            # http://localhost:5173
```

Needs Realx8-Core running (port 3000). The dev server forwards `/api` and
`/uploads` to it, so the browser stays same-origin.

To start **both** with one command, run `npm run dev:all` in Realx8-Core — see
`RUNNING.md` there.

## How it talks to the backend

One base URL, defined in `src/api/apiBase.js` and used by every call:

```
VITE_API_BASE_URL=/api          # relative — the default
```

Relative means requests go to whatever origin serves this app, and the thing in
front of it forwards `/api` to the backend:

| Where | What forwards `/api` |
|---|---|
| `npm run dev` | Vite's proxy → `DEV_API_TARGET` |
| Docker image | this repo's nginx → `API_TARGET` |
| Vercel / Netlify | a rewrite to the API host |

That keeps the browser same-origin, so there is no CORS preflight and no
cookie-or-origin surprises. It is the recommended setup.

To call the backend cross-origin instead, set an absolute URL:

```
VITE_API_BASE_URL=https://realx8-core.up.railway.app/api
```

...and add this app's origin to `CORS_ORIGIN` in Realx8-Core, or the browser
blocks every request. Note Vite **inlines** this at build time, so changing it
requires a rebuild — setting it on a running container does nothing.

The backend serves each route at both `/api/x` and `/x`, and the split shape it
is deployed in makes no difference here. Nothing in this repo needs to change if
services are peeled onto separate deployments later.

## Environment

| | |
|---|---|
| `VITE_API_BASE_URL` | API base. `/api` (relative) or an absolute URL. Build-time. |
| `DEV_API_TARGET` | Dev only: where `npm run dev` forwards `/api`. Default `http://localhost:3000`. |

## Scripts

| | |
|---|---|
| `npm run dev` | dev server on 5173, proxying to the backend |
| `npm run build` | production bundle into `dist/` |
| `npm run preview` | serve the built bundle |
| `npm run docker:up` | build + serve behind nginx on 8080 |
| `npm run cf:deploy` | build + deploy to Cloudflare Workers |
| `npm run cf:dev` | run the Cloudflare worker locally |
| `npm run verify:export` | table export: which value each column contributes, and CSV escaping |
| `npm run verify:dashboard-export` | the dashboard report is built from data, not from the screen |
| `npm run verify:interop` | payload encryption agrees with Realx8-Core about the wire |

## Layout

```
src/
  api/          one module per backend area; apiBase.js owns the base URL,
                client.js the axios instance + token refresh interceptor
  pages/        routed screens
  components/   common/ ui/ layout/ dashboard/ finance/ profile/
  store/        zustand stores (auth, appearance)
  context/      appearance/theming
  hooks/  utils/  constants/  config/
```

`src/api/client.js` attaches the access token to every request and, on a 401,
refreshes once and replays the queued calls. Endpoints that must work without a
session (login, registration, password reset) are allowed through by the
backend's edge — see `platform/edge.js` in Realx8-Core.

## Deploying

**Vercel / Netlify** — build `npm run build`, output `dist`. `vercel.json`
already rewrites all paths to `index.html` for client-side routing. Add a
rewrite from `/api/*` to the backend to stay same-origin, or set an absolute
`VITE_API_BASE_URL` and configure CORS on the backend.

### The CSP names the backend, and Vercel cannot work it out

The app is served with a Content-Security-Policy, and `connect-src` decides
which origins it may call. Where the UI proxies `/api` to the backend, the
browser stays same-origin and `'self'` covers it. Where a build sets an
absolute `VITE_API_BASE_URL`, the page talks to another origin and that origin
has to be named — otherwise every request is blocked before it leaves the
browser, which looks like the whole application is broken.

`worker/index.js` and `nginx.conf.template` read the origin off `API_TARGET`,
so they need nothing. **Vercel reads `vercel.json` statically, with no access
to a build variable, so the origin is a literal there** — in `connect-src`,
`img-src` and `media-src`. When the backend moves, or a second one appears,
that is the file to edit. There is no comment in it saying so, because Vercel's
schema rejects any key it does not recognise.

**Docker** — the image serves the built app and reverse-proxies the API:

```bash
docker build -t realx8-ui .
docker run -p 8080:80 -e API_TARGET=http://realx8-core:3000 realx8-ui
```

`API_TARGET` is read at container start, so the same image points at any
backend.

## Cloudflare

`wrangler.toml` deploys the built app to Cloudflare Workers with static assets.
The worker in `worker/index.js` serves the bundle and forwards `/api` and
`/uploads` to Realx8-Core — the same split nginx does in the Docker image — so
the browser stays same-origin and there is nothing to add to the backend's
`CORS_ORIGIN`.

```bash
npm run cf:deploy          # top-level env, API_TARGET from [vars]
npm run cf:deploy:prod     # [env.production.vars]
```

Set `API_TARGET` per environment in `wrangler.toml`. Unknown paths fall through
to `index.html` (`not_found_handling = "single-page-application"`), so React
routing works without extra rules.

This replaces the `realto/wrangler.toml` that was left in realto-repros. That
one declared `main = "src/index.js"` for a worker that was never written and
bound a D1 (SQLite) database nothing read; it could not have deployed the
backend either, since Sequelize/mysql2 needs a TCP MySQL connection Workers do
not provide.
