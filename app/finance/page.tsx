import { PageHeading } from "../components/ui";
import { createClient } from "../../lib/supabase/server";
import { requireUser } from "../../lib/auth";
import { FinanceClient, type Budget, type Expense, type FinanceUser, type FinanceTask } from "./FinanceClient";

export default async function FinancePage() {
  const user = await requireUser();
  const supabase = createClient();
  const [{ data: expenses, error: expensesError }, { data: budgets, error: budgetsError }, { data: profile, error: profileError }, { data: users, error: usersError }, { data: tasks, error: tasksError }, { data: milestones, error: milestonesError }] = await Promise.all([
    supabase.from("expenses").select("id,amount,currency,category,vendor,description,expense_date,status,submitted_by,approved_by,receipt_path,receipt_url,task_id,milestone_id,created_at,updated_at").order("expense_date", { ascending: false }).limit(1000),
    supabase.from("budgets").select("id,category,budget_month,amount,currency,notes,created_by,created_at,updated_at").order("budget_month", { ascending: false }).limit(500),
    supabase.from("users").select("role").eq("id", user.id).maybeSingle(),
    supabase.from("users").select("id,display_name").eq("is_active", true).order("display_name"),
    supabase.from("tasks").select("id,title").is("archived_at", null).order("title").limit(500),
    supabase.from("milestones").select("id,name").order("target_date").limit(200),
  ]);

  const financeUsers = (users || []) as FinanceUser[];
  const errors = [expensesError, budgetsError, profileError, usersError, tasksError, milestonesError].filter(Boolean).map((error) => error?.message || "Unable to load financial data.");
  return (
    <>
      <PageHeading eyebrow="Operations" title="Finance" subtitle="Track project expenses and budgets without replacing professional accounting advice." />
      <FinanceClient
        currentUserId={user.id}
        canManage={profile?.role === "admin"}
        initialExpenses={(expenses || []) as Expense[]}
        initialBudgets={(budgets || []) as Budget[]}
        users={financeUsers}
        tasks={(tasks || []) as FinanceTask[]}
        milestones={(milestones || []) as { id: string; name: string }[]}
        serverErrors={errors}
      />
    </>
  );
}
