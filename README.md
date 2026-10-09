# Realx8 website (realx8.net)

The public website: what Realx8 does, an onboarding request form, and **Ask Realx8**, an
assistant that answers questions about Realx8 only and can raise an onboarding request or an
enquiry for the visitor.

This is the `website` branch of the Realx8-Ui repository. It shares no code with the app on
`main`/`dev` and is deployed on its own, so the site can change without an app release.

## Run it

```bash
npm install
npm run dev        # http://localhost:5180
npm test           # the assistant's conversation tests
npm run build      # → dist/
```

Copy `.env.example` to `.env` to point at a different API:

| Variable | Default | What it is |
|---|---|---|
| `VITE_API_URL` | `https://realx8-core.onrender.com` | Realx8-Core, which stores requests |
| `VITE_APP_URL` | `https://beta.realx8.net` | The app, for "Sign in" links |

## Where things are

```
src/pages/Home.jsx          the home page
src/pages/Request.jsx       the onboarding request form
src/components/ChatWidget.jsx   Ask Realx8
src/assistant/knowledge.js  everything the assistant knows — edit answers here
src/assistant/engine.js     matching, and collecting details for a request
src/content/features.js     the feature cards and the form's interest chips
public/screens/             screenshots of the app used on the home page
```

The assistant does not use an AI model: every answer is written in `knowledge.js`, so it never
promises a feature the product does not have. A question it cannot answer gets an offer to
raise an enquiry. When a feature ships or changes, update its answer there.

## Requests

The form and the assistant both send `POST /public/website/requests` to Realx8-Core. Each
request gets a reference (e.g. `RX-2026-0042`), the visitor gets an email copy, and the team is
emailed at the platform's support address (Settings → Help & support). Platform admins follow
them up in the app under **Platform Admin → Website Requests**.

## Deploy (Vercel)

1. New Vercel project from the Realx8-Ui repository, **Production Branch: `website`**,
   framework preset Vite (build `npm run build`, output `dist`).
2. Environment variables as in the table above.
3. Domains: `realx8.net` and `www.realx8.net` (redirect one to the other). The app stays on
   `beta.realx8.net`.
4. On Realx8-Core (Render), add `https://realx8.net` and `https://www.realx8.net` to
   `CORS_ORIGIN`, so the browser may send requests from the site.

`vercel.json` holds the page rewrites and security headers. If the API moves, update
`connect-src` in its Content-Security-Policy.
