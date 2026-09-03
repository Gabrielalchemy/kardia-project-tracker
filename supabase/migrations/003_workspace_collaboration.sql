-- Kardia workspace collaboration, organization, reporting, and security additions.
-- This migration is intentionally repeatable: every object is guarded so it can be
-- pasted into an existing Supabase project without changing migrations 001/002.

alter table public.users add column if not exists is_active boolean not null default true;
alter table public.users add column if not exists last_seen_at timestamptz;
alter table public.users add column if not exists availability_status text not null default 'available'
  check (availability_status in ('available', 'away', 'busy', 'offline'));

alter table public.tasks add column if not exists archived_at timestamptz;
alter table public.tasks add column if not exists milestone_id uuid references public.milestones(id) on delete set null;

create table if not exists public.task_dependencies (
  task_id uuid not null references public.tasks(id) on delete cascade,
  depends_on_task_id uuid not null references public.tasks(id) on delete cascade,
  created_by uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, depends_on_task_id),
  constraint task_dependencies_not_self check (task_id <> depends_on_task_id)
);

create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_id uuid not null references public.users(id) on delete cascade,
  body text not null check (length(trim(body)) > 0 and length(body) <= 10000),
  mentioned_user_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  uploaded_by uuid not null references public.users(id) on delete cascade,
  file_name text not null check (length(trim(file_name)) > 0),
  file_url text not null check (length(trim(file_url)) > 0),
  mime_type text,
  file_size bigint check (file_size is null or file_size >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.users(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  body text not null check (length(trim(body)) > 0),
  published_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.saved_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  resource text not null default 'tasks' check (resource in ('tasks', 'blockers', 'updates')),
  filters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, resource, name)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists task_dependencies_depends_on_idx on public.task_dependencies(depends_on_task_id);
create index if not exists task_comments_task_created_idx on public.task_comments(task_id, created_at);
create index if not exists task_attachments_task_created_idx on public.task_attachments(task_id, created_at);
create index if not exists announcements_published_idx on public.announcements(published_at desc);
create index if not exists saved_views_user_resource_idx on public.saved_views(user_id, resource);
create index if not exists audit_logs_entity_idx on public.audit_logs(entity_type, entity_id, created_at desc);
create index if not exists tasks_milestone_idx on public.tasks(milestone_id);

create or replace function public.log_task_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'deleted', 'task', old.id, jsonb_build_object('title', old.title));
    return old;
  elsif tg_op = 'INSERT' then
    insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'created', 'task', new.id, jsonb_build_object('title', new.title));
    return new;
  end if;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'updated', 'task', new.id, jsonb_build_object('title', new.title, 'status', new.status, 'progress_pct', new.progress_pct));
  return new;
end;
$$;
drop trigger if exists tasks_audit_log on public.tasks;
create trigger tasks_audit_log after insert or update or delete on public.tasks
for each row execute procedure public.log_task_change();

create or replace function public.notify_task_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications(user_id, type, message, related_task_id)
    values (new.owner_id, 'task_assigned', 'You were assigned task: ' || new.title, new.id);
  elsif new.owner_id is distinct from old.owner_id then
    insert into public.notifications(user_id, type, message, related_task_id)
    values (new.owner_id, 'task_assigned', 'You were assigned task: ' || new.title, new.id);
  elsif new.status is distinct from old.status and new.owner_id <> auth.uid() then
    insert into public.notifications(user_id, type, message, related_task_id)
    values (new.owner_id, 'task_status', 'Task "' || new.title || '" moved to ' || replace(new.status::text, '_', ' ') || '.', new.id);
  end if;
  return new;
end;
$$;
drop trigger if exists tasks_notify_owner on public.tasks;
create trigger tasks_notify_owner after insert or update of owner_id, status on public.tasks
for each row execute procedure public.notify_task_owner();

create or replace function public.normalize_task_progress()
returns trigger language plpgsql as $$
begin
  if new.status = 'done' then new.progress_pct = 100;
  elsif new.progress_pct = 100 and new.status <> 'done' then new.progress_pct = 99;
  end if;
  return new;
end;
$$;
drop trigger if exists tasks_normalize_progress on public.tasks;
create trigger tasks_normalize_progress before insert or update of status, progress_pct on public.tasks
for each row execute procedure public.normalize_task_progress();

create or replace function public.validate_task_fields()
returns trigger language plpgsql as $$
begin
  if length(trim(new.title)) > 200 then raise exception 'Task title must be 200 characters or fewer'; end if;
  if length(new.description) > 10000 then raise exception 'Task description must be 10,000 characters or fewer'; end if;
  return new;
end;
$$;
drop trigger if exists tasks_validate_fields on public.tasks;
create trigger tasks_validate_fields before insert or update of title, description on public.tasks
for each row execute procedure public.validate_task_fields();

create or replace function public.notify_comment_mentions()
returns trigger language plpgsql security definer set search_path = public as $$
declare mentioned_id uuid;
begin
  foreach mentioned_id in array new.mentioned_user_ids loop
    if mentioned_id is not null and mentioned_id <> auth.uid() then
      insert into public.notifications(user_id, type, message, related_task_id)
      values (mentioned_id, 'mention', 'You were mentioned in a task comment.', new.task_id);
    end if;
  end loop;
  return new;
end;
$$;
drop trigger if exists task_comments_notify_mentions on public.task_comments;
create trigger task_comments_notify_mentions after insert on public.task_comments
for each row execute procedure public.notify_comment_mentions();

alter table public.task_dependencies enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_attachments enable row level security;
alter table public.announcements enable row level security;
alter table public.saved_views enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "authenticated read task dependencies" on public.task_dependencies;
create policy "authenticated read task dependencies" on public.task_dependencies for select to authenticated using (true);
drop policy if exists "authenticated manage task dependencies" on public.task_dependencies;
create policy "authenticated manage task dependencies" on public.task_dependencies for all to authenticated
  using (public.is_admin() or created_by = auth.uid())
  with check (public.is_admin() or created_by = auth.uid());

drop policy if exists "authenticated read task comments" on public.task_comments;
create policy "authenticated read task comments" on public.task_comments for select to authenticated using (true);
drop policy if exists "users create task comments" on public.task_comments;
create policy "users create task comments" on public.task_comments for insert to authenticated with check (author_id = auth.uid());
drop policy if exists "authors update task comments" on public.task_comments;
create policy "authors update task comments" on public.task_comments for update to authenticated
  using (author_id = auth.uid() or public.is_admin()) with check (author_id = auth.uid() or public.is_admin());
drop policy if exists "authors delete task comments" on public.task_comments;
create policy "authors delete task comments" on public.task_comments for delete to authenticated using (author_id = auth.uid() or public.is_admin());

drop policy if exists "authenticated read task attachments" on public.task_attachments;
create policy "authenticated read task attachments" on public.task_attachments for select to authenticated using (true);
drop policy if exists "users create task attachments" on public.task_attachments;
create policy "users create task attachments" on public.task_attachments for insert to authenticated with check (uploaded_by = auth.uid());
drop policy if exists "users delete task attachments" on public.task_attachments;
create policy "users delete task attachments" on public.task_attachments for delete to authenticated using (uploaded_by = auth.uid() or public.is_admin());

drop policy if exists "authenticated read announcements" on public.announcements;
create policy "authenticated read announcements" on public.announcements for select to authenticated using (true);
drop policy if exists "admins manage announcements" on public.announcements;
create policy "admins manage announcements" on public.announcements for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "users manage own saved views" on public.saved_views;
create policy "users manage own saved views" on public.saved_views for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "admins read audit logs" on public.audit_logs;
create policy "admins read audit logs" on public.audit_logs for select to authenticated using (public.is_admin());

drop policy if exists "users update own availability" on public.users;
create policy "users update own availability" on public.users for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
