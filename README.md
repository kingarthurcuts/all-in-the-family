# All in the Family

A shared family calendar with lists and polls. React + Vite on Vercel, Supabase for sign-ins and data.

- **Calendar** (home): month view, tap a day to see/add events, color-coded by who added them. Each event has a type (Plans, Birthday, Party, Dinner, Practice / Game, Appointment, Trip, School) and can ask everyone to RSVP (Going / Maybe / Can’t make it), showing who has and hasn’t answered.
- **Lists**: groceries, chores, anything — check items off and see who added/finished them.
- **Polls**: ask a question, add choices, everyone votes; optional deadline and multi-pick.
- **Chat**: a family group chat plus private one-on-one messages with each member, with unread badges.
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
event_rsvps, lists, list_items, polls, poll_options, poll_votes, messages, chat_reads — all protected by row-level security so
people only ever see their own family's data. Private messages are readable only by their sender and recipient. New families get a 6-character invite code.
