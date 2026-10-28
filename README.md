# All in the Family

A shared family calendar with lists and polls. React + Vite on Vercel, Supabase for sign-ins and data.

- **Calendar** (home): month view, tap a day to see/add events, color-coded by who added them.
- **Lists**: groceries, chores, anything — check items off and see who added/finished them.
- **Polls**: ask a question, add choices, everyone votes; optional deadline and multi-pick.
- **Family**: invite code to share, member list, your name and color.

Everything updates live across phones.

## Run locally

```
npm install
npm run dev
```

## Deploy

Import this repo in Vercel (framework: Vite). No environment variables are required —
the Supabase URL and publishable key are built in (override with `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY` if you ever switch projects).

After the first deploy, in Supabase → Authentication → URL Configuration, set **Site URL**
to your Vercel address so confirmation and password-reset emails link back to the app.

## Database

Supabase project `dglqtnirlvlzzndkeuol`. Tables: profiles, families, family_members, events,
lists, list_items, polls, poll_options, poll_votes — all protected by row-level security so
people only ever see their own family's data. New families get a 6-character invite code.
