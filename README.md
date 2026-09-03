# Kardia Project Tracker

A minimal, polished project dashboard for a three-person wearable hardware team. It tracks sensor, textile, firmware, integration, testing, and demo work toward **25 September 2026**.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). All workspace views are backed by Supabase; empty tables remain empty until your team creates real records.

## Supabase setup

1. Create a Supabase project and copy its URL and anon key into `.env.local` using `.env.example`.
2. In Supabase SQL Editor, run `supabase/migrations/001_schema.sql`.
3. Create the first Auth user: `admin@smartclothing.local` with a temporary password such as `ChangeMe-2026!`. Change it immediately after signing in.
4. Insert that user into `public.users` with role `admin`. Create two more Auth users for teammates and insert them with role `member`. (The Auth user UUID is shown in Supabase Authentication.)
5. Run `supabase/migrations/002_security_hardening.sql` after the first migration. This restricts milestone administration to admins, prevents member role escalation, enables team-wide standup reading, and adds trusted timestamps.
6. Run `supabase/migrations/003_workspace_collaboration.sql`. It is repeatable and adds task dependencies, comments/mentions, attachment metadata, announcements, saved views, audit logs, availability, archiving, assignment/status notifications, and RLS policies.
7. In Supabase Authentication settings, disable public email signups. Accounts should be created manually by the administrator. Add `SUPABASE_SERVICE_ROLE_KEY` only to the server environment if administrator invitations or password-reset emails are required.
8. Run `supabase/migrations/004_task_attachment_storage.sql` to create the private `task-attachments` bucket and its authenticated upload/read/delete policies. The task detail attachment panel supports local uploads and external links; private uploads are opened with temporary signed URLs.
9. Run `supabase/migrations/005_financial_tracking.sql`. It creates expense and monthly budget tables, audit/notification triggers, indexes, and strict RLS. The Finance page supports real expense records, receipt URLs, approval, CSV export, and admin budgets. Amounts are stored as PostgreSQL `numeric(14,2)` values and the UI validates decimal strings; do not sum records in JavaScript as binary floating point.
10. The dashboard, task CRUD/assignment/progress flow, organization filters/saved views, collaboration, notifications, reports, login, standup submission, blockers, milestones, docs, finance, profile, and admin access are wired to Supabase. Apply migrations 003-005 before using their additions.

### Financial tracking caution

Finance is an operational project tracker, not accounting, tax, payroll, reimbursement, or regulatory-compliance software. Currency conversion, tax treatment, receipt retention, approvals, and payment reconciliation remain the responsibility of your team and qualified financial professionals. Use a consistent currency per budget and verify exported CSV data before relying on it.

## Deploy to Vercel

Import this repository in Vercel, set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Project Settings, and deploy. The default Next.js build command is sufficient. Never add a Supabase secret/service-role key to Vercel client-exposed variables.

## How to use with your team

Start by creating your real project milestones and inviting teammates from **Team members**, then create tasks with one owner, a due date, and a workstream. Everyone posts a short update each morning in **Standup**. Record anything that could affect the deadline in **Blockers & risks**, and keep architecture, BOM, assembly, and test links in **Documentation**.

## Structure

```text
app/                  Next.js App Router pages and shared UI
  components/         App shell and reusable pills/headings
  tasks/              list, create, and detail views
supabase/
  migrations/         schema, indexes, and RLS policies
  seed.sql            Auth/user seeding notes
```
