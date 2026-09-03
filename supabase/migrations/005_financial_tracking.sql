-- Kardia financial tracking.
-- Repeatable migration: safe to run after migrations 001-004.
-- This supports operational tracking only; it is not accounting or tax software.

do $$ begin
  create type public.expense_category as enum
    ('materials', 'equipment', 'software', 'services', 'travel', 'meals', 'shipping', 'other');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.expense_status as enum
    ('draft', 'submitted', 'approved', 'rejected', 'paid');
exception when duplicate_object then null;
end $$;

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'USD'
    check (currency = upper(currency) and currency ~ '^[A-Z]{3}$'),
  category public.expense_category not null,
  vendor text not null check (length(trim(vendor)) between 1 and 200),
  description text not null default '' check (length(description) <= 2000),
  expense_date date not null default current_date,
  status public.expense_status not null default 'draft',
  submitted_by uuid not null references public.users(id) on delete restrict,
  approved_by uuid references public.users(id) on delete set null,
  receipt_path text check (receipt_path is null or length(trim(receipt_path)) <= 1000),
  receipt_url text check (receipt_url is null or (length(trim(receipt_url)) <= 2000 and receipt_url ~* '^https?://')),
  task_id uuid references public.tasks(id) on delete set null,
  milestone_id uuid references public.milestones(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status in ('draft', 'submitted', 'approved', 'rejected', 'paid')),
  check (status in ('draft', 'submitted') or approved_by is not null)
);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  category public.expense_category,
  budget_month date not null check (budget_month = date_trunc('month', budget_month)::date),
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'USD'
    check (currency = upper(currency) and currency ~ '^[A-Z]{3}$'),
  notes text not null default '' check (length(notes) <= 1000),
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category, budget_month, currency)
);

alter table public.notifications
  add column if not exists related_expense_id uuid;

-- Add the FK separately so this remains repeatable if an older deployment
-- already added the notification column.
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'notifications_related_expense_id_fkey'
      and conrelid = 'public.notifications'::regclass
  ) then
    alter table public.notifications
      add constraint notifications_related_expense_id_fkey
      foreign key (related_expense_id) references public.expenses(id) on delete set null;
  end if;
exception when undefined_table then null;
end $$;

create index if not exists expenses_date_idx on public.expenses(expense_date desc);
create index if not exists expenses_status_idx on public.expenses(status);
create index if not exists expenses_category_date_idx on public.expenses(category, expense_date desc);
create index if not exists expenses_submitted_by_idx on public.expenses(submitted_by, created_at desc);
create index if not exists expenses_task_idx on public.expenses(task_id);
create index if not exists expenses_milestone_idx on public.expenses(milestone_id);
create index if not exists budgets_month_idx on public.budgets(budget_month desc);
create index if not exists budgets_category_month_idx on public.budgets(category, budget_month desc);
create index if not exists notifications_expense_idx on public.notifications(related_expense_id);

create or replace function public.financial_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists expenses_set_updated_at on public.expenses;
create trigger expenses_set_updated_at before update on public.expenses
for each row execute procedure public.financial_set_updated_at();
drop trigger if exists budgets_set_updated_at on public.budgets;
create trigger budgets_set_updated_at before update on public.budgets
for each row execute procedure public.financial_set_updated_at();

create or replace function public.log_expense_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    lower(tg_op),
    'expense',
    coalesce(new.id, old.id),
    jsonb_build_object(
      'amount', coalesce(new.amount, old.amount),
      'currency', coalesce(new.currency, old.currency),
      'status', coalesce(new.status::text, old.status::text)
    )
  );
  if (tg_op = 'INSERT' and new.status = 'submitted')
     or (tg_op = 'UPDATE' and new.status = 'submitted' and old.status is distinct from new.status) then
    insert into public.notifications(user_id, type, message, related_expense_id)
    select id, 'expense_submitted', 'A new expense is awaiting approval.', new.id
    from public.users where role = 'admin' and is_active = true;
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status
        and new.status in ('approved', 'rejected', 'paid') then
    insert into public.notifications(user_id, type, message, related_expense_id)
    values (
      new.submitted_by,
      'expense_status',
      'Your expense was marked ' || replace(new.status::text, '_', ' ') || '.',
      new.id
    );
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists expenses_audit_log on public.expenses;
create trigger expenses_audit_log after insert or update or delete on public.expenses
for each row execute procedure public.log_expense_change();

create or replace function public.log_budget_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), lower(tg_op), 'budget', coalesce(new.id, old.id),
    jsonb_build_object('month', coalesce(new.budget_month, old.budget_month),
      'amount', coalesce(new.amount, old.amount), 'currency', coalesce(new.currency, old.currency)));
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists budgets_audit_log on public.budgets;
create trigger budgets_audit_log after insert or update or delete on public.budgets
for each row execute procedure public.log_budget_change();

alter table public.expenses enable row level security;
alter table public.budgets enable row level security;

drop policy if exists "authenticated users can read expenses" on public.expenses;
create policy "authenticated users can read expenses" on public.expenses
  for select to authenticated using (true);
drop policy if exists "users can create own expenses" on public.expenses;
create policy "users can create own expenses" on public.expenses
  for insert to authenticated
  with check (
    submitted_by = auth.uid()
    and status in ('draft', 'submitted')
    and approved_by is null
  );
drop policy if exists "users can edit own expense drafts" on public.expenses;
create policy "users can edit own expense drafts" on public.expenses
  for update to authenticated
  using ((submitted_by = auth.uid() and status = 'draft') or public.is_admin())
  with check ((submitted_by = auth.uid() and status in ('draft', 'submitted') and approved_by is null)
    or public.is_admin());
drop policy if exists "users can delete own expense drafts" on public.expenses;
create policy "users can delete own expense drafts" on public.expenses
  for delete to authenticated
  using ((submitted_by = auth.uid() and status = 'draft') or public.is_admin());
drop policy if exists "admins can manage all expenses" on public.expenses;
create policy "admins can manage all expenses" on public.expenses
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "authenticated users can read budgets" on public.budgets;
create policy "authenticated users can read budgets" on public.budgets
  for select to authenticated using (true);
drop policy if exists "admins can manage budgets" on public.budgets;
create policy "admins can manage budgets" on public.budgets
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
