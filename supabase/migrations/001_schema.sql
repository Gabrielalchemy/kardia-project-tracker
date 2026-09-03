
-- Kardia Project Tracker
-- Initial Supabase schema
-- Run this file once in Supabase SQL Editor.

create extension if not exists pgcrypto;

create type public.user_role as enum ('admin', 'member');
create type public.task_status as enum ('todo', 'in_progress', 'review', 'done');
create type public.task_priority as enum ('low', 'medium', 'high', 'critical');
create type public.workstream as enum (
  'sensors',
  'conductive_threads',
  'firmware',
  'integration',
  'testing',
  'demo',
  'docs',
  'other'
);
create type public.milestone_status as enum (
  'planned',
  'in_progress',
  'achieved',
  'at_risk',
  'missed'
);
create type public.blocker_severity as enum ('low', 'medium', 'high', 'critical');
create type public.blocker_status as enum ('open', 'mitigating', 'resolved');
create type public.doc_type as enum ('architecture', 'bom', 'assembly', 'test_plan', 'other');

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  role public.user_role not null default 'member',
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  description text not null default '',
  owner_id uuid not null references public.users(id),
  status public.task_status not null default 'todo',
  priority public.task_priority not null default 'medium',
  due_date date,
  workstream public.workstream not null default 'other',
  tags text[] not null default '{}',
  progress_pct integer not null default 0 check (progress_pct between 0 and 100),
  blocked_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  target_date date not null,
  status public.milestone_status not null default 'planned',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.blockers (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  description text,
  severity public.blocker_severity not null default 'medium',
  owner_id uuid references public.users(id),
  status public.blocker_status not null default 'open',
  target_fix_date date,
  resolution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.updates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  date date not null default current_date,
  yesterday text,
  today text,
  blockers text,
  created_at timestamptz not null default now(),
  constraint updates_user_date_unique unique (user_id, date)
);

create table public.docs (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  type public.doc_type not null default 'other',
  url text not null check (length(trim(url)) > 0),
  description text,
  linked_task_id uuid references public.tasks(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null,
  message text not null,
  is_read boolean not null default false,
  related_task_id uuid references public.tasks(id) on delete set null,
  related_blocker_id uuid references public.blockers(id) on delete set null,
  created_at timestamptz not null default now()
);

create index tasks_due_date_idx on public.tasks(due_date);
create index tasks_owner_id_idx on public.tasks(owner_id);
create index tasks_status_idx on public.tasks(status);
create index tasks_workstream_idx on public.tasks(workstream);
create index blockers_status_idx on public.blockers(status);
create index blockers_severity_idx on public.blockers(severity);
create index notifications_user_read_idx on public.notifications(user_id, is_read);
create index updates_date_idx on public.updates(date desc);

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.users
    where id = auth.uid()
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, display_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      split_part(coalesce(new.email, ''), '@', 1),
      'Team member'
    ),
    'member'
  )
  on conflict (id) do update
    set email = excluded.email;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();

alter table public.users enable row level security;
alter table public.tasks enable row level security;
alter table public.milestones enable row level security;
alter table public.blockers enable row level security;
alter table public.updates enable row level security;
alter table public.docs enable row level security;
alter table public.notifications enable row level security;

create policy "authenticated users can read profiles"
  on public.users for select
  to authenticated
  using (true);

create policy "users can update their own display name"
  on public.users for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "admins can manage profiles"
  on public.users for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "authenticated users can read tasks"
  on public.tasks for select
  to authenticated
  using (true);

create policy "authenticated users can manage tasks"
  on public.tasks for insert
  to authenticated
  with check (true);

create policy "authenticated users can update tasks"
  on public.tasks for update
  to authenticated
  using (true)
  with check (true);

create policy "authenticated users can delete tasks"
  on public.tasks for delete
  to authenticated
  using (true);

create policy "authenticated users can read milestones"
  on public.milestones for select
  to authenticated
  using (true);

create policy "authenticated users can manage milestones"
  on public.milestones for all
  to authenticated
  using (true)
  with check (true);

create policy "authenticated users can read blockers"
  on public.blockers for select
  to authenticated
  using (true);

create policy "authenticated users can manage blockers"
  on public.blockers for all
  to authenticated
  using (true)
  with check (true);

create policy "authenticated users can read updates"
  on public.updates for select
  to authenticated
  using (true);

create policy "users can create their own updates"
  on public.updates for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "users can update their own updates"
  on public.updates for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users can delete their own updates"
  on public.updates for delete
  to authenticated
  using (user_id = auth.uid());

create policy "authenticated users can read docs"
  on public.docs for select
  to authenticated
  using (true);

create policy "admins can manage docs"
  on public.docs for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "users can read their notifications"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

create policy "users can update their notifications"
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
