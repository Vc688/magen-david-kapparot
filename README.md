# Kapparot — Congregation Magen David of West Deal

Online Kapparot form: donors enter the Hebrew name(s) of each person, pay a fixed
amount per name through Stripe Checkout, and the rabbi gets a list of names to
perform Kapparot on their behalf. Modeled on the MyShul "Kapparot" smart form.

Same stack and wiring as the bag-sale site (Next.js App Router, Stripe Checkout,
password-protected admin, file-based JSON storage in `data/`), kept as a
separate app so donors never see the bag sale.

## What's included

- Public page with countdown to the deadline, editable explanatory text, a
  repeatable "Add another name" form (gender + Hebrew name), optional
  additional donation, and an optional "cover transaction fee" checkbox that
  uses Stripe's 2.9% + 30¢ gross-up.
- Server-side pricing and deadline enforcement — the client's total is never trusted.
- Stripe Checkout (hosted) with names in the payment metadata; webhook marks
  submissions paid; the thank-you page also confirms directly with Stripe so it
  works even before the webhook is configured.
- Admin dashboard at `/admin`: paid names, totals, search, status/notes, a
  "Kapparot performed" checkbox, CSV export (one row per name), and a
  print-friendly names list at `/admin/names` grouped by gender.
- "Site content & settings" tab: deadline, price per person, toggles, and every
  piece of copy — saved to `data/site-content.json`, live immediately.

## Setup

```powershell
corepack pnpm install
Copy-Item .env.example .env.local
```

Fill in `.env.local`:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
ADMIN_PASSWORD=choose-a-long-password
```

Run:

```powershell
corepack pnpm dev
```

- Public page: http://localhost:3000
- Admin: http://localhost:3000/admin

## Stripe

Webhook endpoint: `/api/webhooks/stripe` — subscribe to
`checkout.session.completed` and `checkout.session.expired`.

Use test keys first. Switch to live keys only after a test submission shows as
**paid** in the admin dashboard.

## Deploy (Railway)

- Push to `main`; Railway builds with pnpm (do not commit a `package-lock.json`).
- Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `ADMIN_PASSWORD` in the service variables.
- Mount a **persistent volume at `/app/data`** (or wherever the app's `data/`
  folder lives) so submissions and admin edits survive redeploys. Defaults are
  baked into code, so the site renders without the volume — only submissions
  and content edits need it.
- Redirect URLs are derived from the request host, so no `BASE_URL` is needed
  when the domain changes.

## Data files (`data/`, gitignored)

- `submissions.json` — every submission with names, amounts, and Stripe IDs
- `stripe-events.json` — processed webhook event IDs (idempotency)
- `site-content.json` — admin overrides of copy and settings
