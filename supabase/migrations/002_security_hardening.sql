-- Run this after 001_schema.sql. It is safe to run on an existing project.

-- Only admins can change project structure; members can still manage blockers.
drop policy if exists "authenticated milestones" on public.milestones;
drop policy if exists "authenticated read milestones" on public.milestones;
drop policy if exists "authenticated users can manage milestones" on public.milestones;
drop policy if exists "admin manage milestones" on public.milestones;
create policy "authenticated read milestones" on public.milestones
  for select to authenticated using (true);
create policy "admin manage milestones" on public.milestones
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Team members may read all standups, but can only write their own.
drop policy if exists "own updates" on public.updates;
drop policy if exists "authenticated read updates" on public.updates;
drop policy if exists "users can read updates" on public.updates;
drop policy if exists "authenticated users can read updates" on public.updates;
drop policy if exists "own update insert" on public.updates;
drop policy if exists "own update change" on public.updates;
drop policy if exists "own update delete" on public.updates;
create policy "authenticated read updates" on public.updates
  for select to authenticated using (true);
create policy "own update insert" on public.updates
  for insert to authenticated with check (user_id = auth.uid());
create policy "own update change" on public.updates
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own update delete" on public.updates
  for delete to authenticated using (user_id = auth.uid());

-- A member must never be able to promote themselves or alter their identity.
create or replace function public.protect_user_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() = old.id and not public.is_admin() then
    new.id := old.id;
    new.email := old.email;
    new.role := old.role;
  end if;
  return new;
end;
$$;
drop trigger if exists protect_user_profile_fields on public.users;
create trigger protect_user_profile_fields
  before update on public.users
  for each row execute procedure public.protect_user_profile();

-- Keep modified timestamps trustworthy regardless of which client performs a write.
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at before update on public.tasks for each row execute procedure public.set_updated_at();
drop trigger if exists milestones_set_updated_at on public.milestones;
create trigger milestones_set_updated_at before update on public.milestones for each row execute procedure public.set_updated_at();
drop trigger if exists blockers_set_updated_at on public.blockers;
create trigger blockers_set_updated_at before update on public.blockers for each row execute procedure public.set_updated_at();
drop trigger if exists docs_set_updated_at on public.docs;
create trigger docs_set_updated_at before update on public.docs for each row execute procedure public.set_updated_at();

-- Explicitly limit schema exposure to the API roles used by the app.
revoke all on schema public from anon;
grant usage on schema public to anon, authenticated;
revoke all on all tables in schema public from anon;
