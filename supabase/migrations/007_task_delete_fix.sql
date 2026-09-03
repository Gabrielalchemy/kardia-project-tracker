-- Kardia task deletion fix.
-- Run after migration 006. This uses a new function name so it replaces
-- neither an older function nor a function with stale Storage SQL.

create or replace function public.delete_task_v2(target_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;

  if not exists (select 1 from public.tasks where id = target_task_id) then
    raise exception 'Task not found.';
  end if;

  delete from public.task_dependencies
    where task_id = target_task_id or depends_on_task_id = target_task_id;
  delete from public.task_comments where task_id = target_task_id;
  delete from public.task_attachments where task_id = target_task_id;
  update public.docs set linked_task_id = null where linked_task_id = target_task_id;
  update public.notifications set related_task_id = null where related_task_id = target_task_id;
  update public.expenses set task_id = null where task_id = target_task_id;
  delete from public.tasks where id = target_task_id;
end;
$$;

revoke all on function public.delete_task_v2(uuid) from public;
grant execute on function public.delete_task_v2(uuid) to authenticated;
