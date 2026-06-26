# Trellishub ("Trellis")

Marketing site + booking flow + scripted chatbot + customer accounts + developer admin dashboard for the Trellis web development agency. Static HTML/CSS/vanilla JS frontend, Vercel Serverless Functions backend, Supabase (Postgres) database.

## Stack

- **Frontend:** static HTML5, CSS (custom properties, no framework), vanilla JS (ES6, no bundler)
- **Backend:** Vercel Serverless Functions (Node.js) under `/api`
- **Database:** Supabase (Postgres)
- **Email:** Nodemailer via a Gmail App Password (`info.trellishub@gmail.com`)
- **Auth:** custom JWT cookie sessions — email/password + "Sign in with Google" for customers, a separate password-only login for the two developers (`/admin`)

## One-time manual setup (do this before deploying)

1. **Supabase** — create a project at supabase.com. In the SQL editor, run the schema in `supabase-schema.sql` (see below). Grab the **Project URL** and **service_role key** from Settings → API.
2. **Gmail App Password** — on the `info.trellishub@gmail.com` Google account, enable 2-Step Verification, then create an App Password (Google Account → Security → App Passwords). Use this, not the normal Gmail password.
3. **Google OAuth Client ID** (for "Sign in with Google") — Google Cloud Console → APIs & Services → Credentials → Create Credentials → OAuth client ID → Web application. Add your production URL (and `http://localhost:3000` for local dev) under Authorized JavaScript origins. Copy the Client ID — no client secret is needed for this sign-in flow.
4. **Admin passwords** — pick a password for each developer, then run:
   ```
   node scripts/hash-password.js "your-chosen-password"
   ```
   for each, and save the resulting bcrypt hash for the env vars below.
5. **JWT secret** — generate any long random string, e.g. `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

## Environment variables

Copy `.env.example` to `.env` for local dev, and set the same keys in Vercel (Project Settings → Environment Variables) for Production + Preview:

| Variable | Where it comes from |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase project → Settings → API |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | Step 2 above |
| `GOOGLE_OAUTH_CLIENT_ID` | Step 3 above |
| `JWT_SECRET` | Step 5 above |
| `ADMIN_NAME_1` / `ADMIN_PASSWORD_HASH_1`, `ADMIN_NAME_2` / `ADMIN_PASSWORD_HASH_2` | Step 4 above |
| `SITE_URL` | Your deployed URL (used in password-reset emails) |
| `GEO_API_KEY` | Only needed if you outgrow ipapi.co's free tier |

## Local development

```
npm install
npx vercel dev
```

`vercel dev` serves both the static files and the `/api` serverless functions together (needs the Vercel CLI logged in, or just run `vercel link` once). A plain static server (e.g. `npx http-server`) will serve the pages but `/api/*` calls will 404 — fine for visually checking layout, not for testing booking/chat/auth end to end.

## Deployment

1. Push this repo to GitHub (or connect it directly) and import it into Vercel.
2. Set all environment variables above in the Vercel dashboard.
3. Deploy. `vercel.json` already configures the clean URLs for `/privacy-policy`, `/my-account`, `/admin`, and `/admin/dashboard`.
4. Connect a custom domain under Project Settings → Domains once you have one — until then the `*.vercel.app` URL works fine.
5. Update `SITE_URL` and the URLs in `sitemap.xml` to match your final domain.

## Project structure

- `index.html` — the one-page public site (Hero → Footer, all anchor-linked sections)
- `privacy-policy.html`, `my-account.html` — supporting customer-facing pages
- `admin/` — developer-only login + dashboard (Leads / Bookings / Chat Conversations / Customers)
- `assets/css/` — design system (`tokens.css`) + per-area stylesheets
- `assets/js/` — nav/scroll/reveal (`main.js`), pricing & currency (`pricing.js`), form + auth-gating (`forms.js`), customer auth (`auth.js`), My Account (`my-account.js`), and the chatbot (`assets/js/chatbot/`)
- `api/` — serverless functions: `contact.js`, `booking.js`, `geo.js`, `chat/*`, `auth/*`, `account/*`, `admin/*`
- `lib/` — shared server-only helpers (Supabase client, mailer, auth/JWT, validation, rate limiting, pricing zones)
- `scripts/hash-password.js` — one-off helper to generate admin password hashes

## Supabase schema

```sql
create extension if not exists pgcrypto;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  email text not null unique,
  password_hash text,
  google_id text unique,
  reset_token text,
  reset_token_expires_at timestamptz,
  last_login_at timestamptz
);

create table public.care_plans (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  status text not null default 'inactive',
  currency text,
  monthly_price numeric,
  start_date date,
  renewal_date date,
  cancellation_requested_at timestamptz,
  cancelled_at timestamptz,
  notes text
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  customer_id uuid not null references public.customers(id),
  name text not null,
  email text not null,
  phone text,
  company text,
  message text not null,
  status text not null default 'new',
  ip_country text,
  user_agent text
);
create index leads_created_at_idx on public.leads (created_at desc);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  customer_id uuid not null references public.customers(id),
  name text not null,
  email text not null,
  phone text,
  booking_type text not null,
  preferred_date date,
  preferred_time text,
  notes text,
  status text not null default 'pending',
  confirmation_email_sent boolean default false,
  notification_email_sent boolean default false
);
create index bookings_created_at_idx on public.bookings (created_at desc);

create table public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  captured_name text,
  captured_email text,
  captured_phone text,
  captured_project_details text,
  last_node_id text,
  escalated boolean not null default false,
  escalation_count integer not null default 0,
  page_url text,
  user_agent text
);
create index chat_conversations_started_at_idx on public.chat_conversations (started_at desc);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  created_at timestamptz not null default now(),
  sender text not null,
  node_id text,
  message_text text not null,
  selected_option_index integer,
  is_escalation boolean not null default false
);
create index chat_messages_conversation_id_idx on public.chat_messages (conversation_id);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  invoice_no text not null,
  description text,
  amount numeric,
  currency text default 'USD',
  date date not null default current_date,
  status text not null default 'paid'
);
create index invoices_customer_id_idx on public.invoices (customer_id, date desc);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  date date not null default current_date,
  amount numeric,
  currency text default 'USD',
  method text,
  reference text
);
create index payments_customer_id_idx on public.payments (customer_id, date desc);

alter table public.customers enable row level security;
alter table public.care_plans enable row level security;
alter table public.leads enable row level security;
alter table public.bookings enable row level security;
alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;
alter table public.invoices enable row level security;
alter table public.payments enable row level security;
-- No policies are added for the anon key on purpose — every read/write goes through
-- the serverless functions using the service_role key, which bypasses RLS. This means
-- the public anon key (even if it ever leaked) grants no access at all.
```

## Notes on what's intentionally NOT built (v1 scope)

- No payment gateway — Care Plan billing/cancellation is a status + email-notification flow your team processes manually via the admin Customers tab.
- No live Google Calendar sync — bookings save to Supabase and send confirmation/notification emails only.
- The chatbot is fully scripted (no AI API) — see `assets/js/chatbot/chatbot-data.js` to edit its conversation tree.
