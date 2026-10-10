# Realx8 website (realx8.net)

The public website: what Realx8 does, the plans and the 7-day free trial, an onboarding / trial
request form, and **Ask Realx8**, an assistant that answers questions about Realx8 only and can
start a free trial, raise an onboarding request or an enquiry for the visitor.

This is the `website` branch of the Realx8-Ui repository. It shares no code with the app on
`main`/`dev` and is deployed on its own, so the site can change without an app release.

## Run it

```bash
npm install
npm run dev        # http://localhost:5180
npm test           # the assistant's conversation tests and the plan helpers
npm run build      # → dist/
```

Copy `.env.example` to `.env` to point at a different API:

| Variable | Default | What it is |
|---|---|---|
| `VITE_API_URL` | `https://realx8-core.onrender.com` | Realx8-Core, which stores requests and serves the plans |
| `VITE_APP_URL` | `https://beta.realx8.net` | The app, for "Sign in" links |

## Where things are

```
src/pages/Home.jsx          the home page
src/pages/Pricing.jsx       the pricing page: plans, the free trial and FAQ
src/pages/Request.jsx       the onboarding / free-trial request form
src/content/plans.js        the built-in copy of the plans, the trial length and price helpers
src/usePlans.js             the plans to show: built-in first, then GET /public/plans
src/components/ChatWidget.jsx   Ask Realx8
src/assistant/knowledge.js  everything the assistant knows — edit answers here
src/assistant/engine.js     matching, and collecting details for a request
src/content/features.js     the feature cards and the form's interest chips
public/screens/             screenshots of the app used on the home page
```

The assistant does not use an AI model: every answer is written in `knowledge.js`, so it never
promises a feature the product does not have. A question it cannot answer gets an offer to
raise an enquiry. When a feature ships or changes, update its answer there.

## Pricing

`/pricing` shows the plans with a Monthly / Annual switch, the annual saving (worked out from
the two prices, not typed in), the user limit, and a "Start 7-day free trial" button per plan
that opens `/request?trial=1&plan=<code>`.

Prices are set in the app, not here. Realx8-Core serves them at `GET /public/plans`:

```json
{ "data": [{ "code": "starter", "name": "Starter", "description": "…", "monthly_price": 50000,
             "annual_price": 500000, "currency": "NGN", "user_limit": 100, "sort_order": 1,
             "active": true }],
  "trial_days": 7 }
```

`user_limit: null` means unlimited. The site renders at once from the copy in
`src/content/plans.js`, then swaps in the served plans when they arrive — so a price changed in
the app shows on the next visit without a redeploy, and the page still shows prices if the API
is slow or down. A response that is not usable (an error, no plans, plans without valid NGN
prices) is ignored and the built-in copy stays. Keep that copy in step with the app, so the swap
is invisible.

The assistant's pricing answers are written from the same built-in copy, so they change on the
next deploy rather than live.

## Requests

The form and the assistant both send `POST /public/website/requests` to Realx8-Core, as kind
`onboarding`, `trial` (the same request, from any "Start free trial" link — `/request?trial=1` —
or from asking the assistant for a trial) or `enquiry`. A plan the visitor picked travels in
`interests` as "Interested in the Professional plan". Each
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
