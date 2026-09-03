-- Kardia finance currency defaults.
-- Existing records are preserved; new finance records default to Kenyan Shillings.

alter table public.expenses
  alter column currency set default 'KES';

alter table public.budgets
  alter column currency set default 'KES';
