# Realx8-Ui

The Realx8 web app — React + Vite + Tailwind. Deployed independently of the
backend, which lives in [`Realx8-Core`](../Realx8-Core).

```bash
cp .env.example .env
npm install
npm run dev            # http://localhost:5173
```

Needs Realx8-Core running (`npm start` in that repo, port 3000). The dev server
forwards `/api` and `/uploads` to it, so the browser stays same-origin.

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

**Docker** — the image serves the built app and reverse-proxies the API:

```bash
docker build -t realx8-ui .
docker run -p 8080:80 -e API_TARGET=http://realx8-core:3000 realx8-ui
```

`API_TARGET` is read at container start, so the same image points at any
backend.

## Known gap

`stripeCreateIntent`, `flutterwaveVerify` and `paystackVerify` in
`src/api/financeApi.js` call `/payments/*`, which no backend service implements.
They 404 today and did before this repo was split out. Either implement those
routes in `finance-service` or drop the three functions.
