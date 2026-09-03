"use client";

import { useMemo, useState } from "react";
import { BarChart3, Check, Download, Pencil, Plus, Receipt, Save, Trash2, WalletCards, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/browser";

export type Expense = {
  id: string;
  amount: string | number;
  currency: string;
  category: string;
  vendor: string;
  description: string;
  expense_date: string;
  status: string;
  submitted_by: string;
  approved_by: string | null;
  receipt_path: string | null;
  receipt_url: string | null;
  task_id: string | null;
  milestone_id: string | null;
  created_at: string;
  updated_at: string;
};
export type Budget = { id: string; category: string | null; budget_month: string; amount: string | number; currency: string; notes: string; created_by: string; created_at: string; updated_at: string };
export type FinanceUser = { id: string; display_name: string };
export type FinanceTask = { id: string; title: string };

const categories = ["materials", "equipment", "software", "services", "travel", "meals", "shipping", "other"];
const statuses = ["draft", "submitted", "approved", "rejected", "paid"];
const DEFAULT_CURRENCY = "KES";
const today = new Date().toISOString().slice(0, 10);
const monthStart = `${today.slice(0, 7)}-01`;

function normalizeAmount(value: string): string | null {
  const input = value.trim();
  if (!/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/.test(input)) return null;
  const [whole, fraction = ""] = input.split(".");
  if (BigInt(whole) === BigInt(0) && Number(fraction || "0") === 0) return null;
  return `${whole}.${fraction.padEnd(2, "0")}`;
}
function toMinor(value: string | number): bigint {
  const normalized = normalizeAmount(String(value)) || "0.00";
  const [whole, fraction] = normalized.split(".");
  return BigInt(whole) * BigInt(100) + BigInt(fraction);
}
function formatMinor(value: bigint, currency: string) {
  const negative = value < BigInt(0);
  const absolute = negative ? -value : value;
  const raw = absolute.toString().padStart(3, "0");
  const decimal = `${raw.slice(0, -2)}.${raw.slice(-2)}`;
  const formatted = new Intl.NumberFormat("en-KE", { style: "currency", currency, currencyDisplay: "code", minimumFractionDigits: 2 }).format(Number(decimal));
  const display = currency === DEFAULT_CURRENCY ? formatted.replace("KES", "Ksh") : formatted;
  return negative ? `-${display}` : display;
}
function label(value: string | null) {
  return value ? value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "All categories";
}
function escapeCsv(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export function FinanceClient({ currentUserId, canManage, initialExpenses, initialBudgets, users, tasks, milestones, serverErrors }: {
  currentUserId: string; canManage: boolean; initialExpenses: Expense[]; initialBudgets: Budget[]; users: FinanceUser[]; tasks: FinanceTask[]; milestones: { id: string; name: string }[]; serverErrors: string[];
}) {
  const router = useRouter();
  const [expenses, setExpenses] = useState(initialExpenses);
  const [budgets, setBudgets] = useState(initialBudgets);
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [currencyFilter, setCurrencyFilter] = useState(DEFAULT_CURRENCY);
  const [search, setSearch] = useState("");
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [editing, setEditing] = useState<Expense | undefined>();
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | undefined>();
  const [error, setError] = useState(serverErrors.join(" "));
  const [notice, setNotice] = useState("");

  const currencies = useMemo(() => Array.from(new Set(expenses.map((expense) => expense.currency))).sort(), [expenses]);
  const filtered = useMemo(() => expenses.filter((expense) => {
    const haystack = `${expense.vendor} ${expense.description} ${expense.category}`.toLowerCase();
    return (!from || expense.expense_date >= from) && (!to || expense.expense_date <= to)
      && (statusFilter === "all" || expense.status === statusFilter)
      && (categoryFilter === "all" || expense.category === categoryFilter)
      && (currencyFilter === "all" || expense.currency === currencyFilter)
      && (!search.trim() || haystack.includes(search.trim().toLowerCase()));
  }), [expenses, from, to, statusFilter, categoryFilter, currencyFilter, search]);
  const totalsByCurrency = (rows: Expense[], predicate?: (expense: Expense) => boolean) => {
    const totals = new Map<string, bigint>();
    rows.filter(predicate || (() => true)).forEach((expense) => totals.set(expense.currency, (totals.get(expense.currency) || BigInt(0)) + toMinor(expense.amount)));
    return Array.from(totals.entries()).map(([currency, amount]) => formatMinor(amount, currency)).join(" · ") || "—";
  };
  const periodSpend = totalsByCurrency(filtered, (expense) => expense.status !== "rejected");
  const approvedPaid = totalsByCurrency(filtered, (expense) => expense.status === "approved" || expense.status === "paid");
  const pending = totalsByCurrency(filtered, (expense) => expense.status === "submitted");
  const selectedBudget = currencyFilter === "all" ? [] : budgets.filter((budget) => budget.currency === currencyFilter && budget.budget_month >= (from || monthStart).slice(0, 7) + "-01" && budget.budget_month <= (to || today).slice(0, 7) + "-01");
  const budgetTotal = selectedBudget.reduce((sum, budget) => sum + toMinor(budget.amount), BigInt(0));
  const spendTotal = filtered.filter((expense) => expense.currency === currencyFilter && expense.status !== "rejected").reduce((sum, expense) => sum + toMinor(expense.amount), BigInt(0));
  const variance = currencyFilter !== "all" && selectedBudget.length ? formatMinor(budgetTotal - spendTotal, currencyFilter) : "Select one currency";
  const chartCurrency = currencyFilter !== "all" ? currencyFilter : currencies[0] || DEFAULT_CURRENCY;
  const chartExpenses = filtered.filter((expense) => expense.currency === chartCurrency && expense.status !== "rejected");
  const categoryTotals = categories.map((category) => ({
    category,
    amount: chartExpenses.filter((expense) => expense.category === category).reduce((sum, expense) => sum + toMinor(expense.amount), BigInt(0))
  })).filter(item => item.amount > BigInt(0)).sort((a, b) => a.amount > b.amount ? -1 : a.amount < b.amount ? 1 : 0);
  const categoryMax = categoryTotals[0]?.amount || BigInt(1);
  const categoryTotal = chartExpenses.reduce((sum, expense) => sum + toMinor(expense.amount), BigInt(0)) || BigInt(1);
  let categoryOffset = 0;
  const categorySlices = categoryTotals.map((item, index) => {
    const start = categoryOffset;
    categoryOffset += Number(item.amount * BigInt(100) / categoryTotal);
    return `${["#242424","#ff6d29","#6b625d","#b7aaa3","#8a9b91","#c9b37e","#7c8ca5","#d28c73"][index % 8]} ${start}% ${categoryOffset}%`;
  });
  const monthTotals = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(today.slice(0, 7) + "-01T00:00:00");
    date.setMonth(date.getMonth() - (5 - index));
    const month = date.toISOString().slice(0, 7);
    return { month, label: date.toLocaleDateString(undefined, { month: "short" }), amount: chartExpenses.filter(expense => expense.expense_date.slice(0, 7) === month).reduce((sum, expense) => sum + toMinor(expense.amount), BigInt(0)) };
  });
  const monthMax = monthTotals.reduce((max, item) => item.amount > max ? item.amount : max, BigInt(1));

  async function mutate(action: () => Promise<{ error: { message: string } | null }>, success: string) {
    setError(""); setNotice("");
    try {
      const result = await action();
      if (result.error) { setError(result.error.message); return false; }
      setNotice(success); router.refresh(); return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to complete the Supabase request.");
      return false;
    }
  }
  async function removeExpense(expense: Expense) {
    if (!window.confirm(`Delete the draft expense from ${expense.vendor}?`)) return;
    const ok = await mutate(async () => createClient().from("expenses").delete().eq("id", expense.id), "Expense deleted.");
    if (ok) setExpenses((current) => current.filter((item) => item.id !== expense.id));
  }
  async function changeStatus(expense: Expense, status: string) {
    const ok = await mutate(async () => createClient().from("expenses").update({ status, approved_by: status === "approved" || status === "rejected" || status === "paid" ? currentUserId : null }).eq("id", expense.id), `Expense ${status}.`);
    if (ok) setExpenses((current) => current.map((item) => item.id === expense.id ? { ...item, status, approved_by: status === "approved" || status === "rejected" || status === "paid" ? currentUserId : null } : item));
  }
  function exportCsv() {
    const header = ["Date", "Vendor", "Category", "Amount", "Currency", "Status", "Description", "Receipt URL"];
    const rows = filtered.map((expense) => [expense.expense_date, expense.vendor, expense.category, String(expense.amount), expense.currency, expense.status, expense.description, expense.receipt_url || ""]);
    const blob = new Blob([[header, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `kardia-expenses-${today}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }

  return <div style={{ display: "grid", gap: 18 }}>
    {error && <div className="card" role="alert" style={{ borderColor: "#b65b4c", color: "#8a3f35" }}>{error}</div>}
    {notice && <div className="card" role="status" style={{ borderColor: "#7aa68c", color: "#3d765f" }}>{notice}</div>}
    <div className="grid stats-grid finance-stats-grid">
      <Metric title="Period spend" value={periodSpend} note="Excludes rejected records" />
      <Metric title="Approved / paid" value={approvedPaid} note="Committed or settled" />
      <Metric title="Pending approval" value={pending} note="Submitted expenses" />
      <Metric title="Budget variance" value={variance} note={currencyFilter === "all" ? "Choose a currency filter" : "Positive means under budget"} />
    </div>
    <div className="finance-analytics-grid">
      <section className="card finance-chart-card"><div className="section-title"><span><BarChart3 size={16} style={{ verticalAlign: "middle", marginRight: 7 }} />Spending overview</span><span className="finance-chart-currency">{chartCurrency || "No currency"}</span></div><p className="finance-chart-caption">Approved, paid, and submitted project spend by month.</p><div className="finance-bars">{monthTotals.map(item => <div className="finance-bar-column" key={item.month}><span className="finance-bar-value">{item.amount > BigInt(0) ? formatMinor(item.amount, chartCurrency) : ""}</span><div className="finance-bar-track"><div className="finance-bar" style={{ height: `${item.amount === BigInt(0) ? 3 : Math.max(10, Number(item.amount * BigInt(100) / monthMax))}%` }} /></div><span>{item.label}</span></div>)}</div></section>
      <section className="card finance-chart-card"><div className="section-title"><span>Spend by category</span><span className="finance-chart-currency">{chartCurrency || "No currency"}</span></div>{categoryTotals.length ? <div className="finance-category-chart"><div className="finance-donut" style={{ background: `conic-gradient(${categorySlices.join(", ")})` }}><div>{formatMinor(categoryTotal, chartCurrency)}</div></div><div className="finance-legend">{categoryTotals.slice(0, 5).map((item, index) => <div key={item.category}><span className="finance-legend-dot" style={{ background: ["#242424","#ff6d29","#6b625d","#b7aaa3","#8a9b91"][index] }} /><span>{label(item.category)}</span><strong>{formatMinor(item.amount, chartCurrency)}</strong></div>)}</div></div> : <div className="finance-chart-empty">Add expenses to see category distribution.</div>}</section>
    </div>
    <div className="card table-card">
      <div className="table-tools">
        <input className="filter" type="date" aria-label="From date" value={from} onChange={(event) => setFrom(event.target.value)} />
        <input className="filter" type="date" aria-label="To date" value={to} onChange={(event) => setTo(event.target.value)} />
        <select className="filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{label(status)}</option>)}</select>
        <select className="filter" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">All categories</option>{categories.map((category) => <option key={category} value={category}>{label(category)}</option>)}</select>
        <select className="filter" value={currencyFilter} onChange={(event) => setCurrencyFilter(event.target.value)}><option value={DEFAULT_CURRENCY}>Kenyan Shillings (Ksh)</option><option value="all">All currencies</option>{currencies.filter((currency) => currency !== DEFAULT_CURRENCY).map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select>
        <input className="filter" placeholder="Search vendor or description" value={search} onChange={(event) => setSearch(event.target.value)} />
        <span style={{ flex: 1 }} />
        <button className="btn" onClick={exportCsv} disabled={!filtered.length}><Download size={14} />Export CSV</button>
        <button className="btn btn-primary" onClick={() => { setEditing(undefined); setShowExpenseForm(true); }}><Plus size={14} />Add expense</button>
      </div>
      {!filtered.length ? <div style={{ padding: 28, textAlign: "center" }}><WalletCards size={24} /><p className="subtitle" style={{ marginTop: 8 }}>{expenses.length ? "No expenses match these filters." : "No expenses yet. Add a real project expense to get started."}</p></div> :
        <table className="table"><thead><tr><th>Date</th><th>Vendor / description</th><th>Category</th><th>Amount</th><th>Status</th><th>Submitted by</th><th>Receipt</th><th>Actions</th></tr></thead><tbody>{filtered.map((expense) => {
          const owner = users.find((item) => item.id === expense.submitted_by)?.display_name || "Team member";
          const editable = expense.submitted_by === currentUserId && expense.status === "draft";
          return <tr key={expense.id}><td>{expense.expense_date}</td><td><strong>{expense.vendor}</strong><div className="task-owner">{expense.description || "No description"}</div></td><td><span className="pill pill-gray">{label(expense.category)}</span></td><td>{formatMinor(toMinor(expense.amount), expense.currency)}<div className="task-owner">{expense.currency}</div></td><td><span className={`pill ${expense.status === "approved" || expense.status === "paid" ? "pill-green" : expense.status === "rejected" ? "pill-red" : expense.status === "submitted" ? "pill-yellow" : "pill-gray"}`}>{label(expense.status)}</span></td><td>{owner}</td><td>{expense.receipt_url ? <a href={expense.receipt_url} target="_blank" rel="noreferrer" className="btn" style={{ minHeight: 30, padding: "5px 8px" }}><Receipt size={12} />Open</a> : "—"}</td><td><div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{editable && <><button className="btn" onClick={() => { setEditing(expense); setShowExpenseForm(true); }} title="Edit draft"><Pencil size={12} /></button><button className="btn danger-action" onClick={() => removeExpense(expense)} title="Delete draft"><Trash2 size={12} /></button><button className="btn" onClick={() => changeStatus(expense, "submitted")}>Submit</button></>}{canManage && expense.status === "submitted" && <><button className="btn" onClick={() => changeStatus(expense, "approved")}><Check size={12} />Approve</button><button className="btn danger-action" onClick={() => changeStatus(expense, "rejected")}><X size={12} />Reject</button></>}{canManage && expense.status === "approved" && <button className="btn" onClick={() => changeStatus(expense, "paid")}>Mark paid</button>}</div></td></tr>;
        })}</tbody></table>}
    </div>
    {showExpenseForm && <ExpenseForm expense={editing} currentUserId={currentUserId} tasks={tasks} milestones={milestones} onCancel={() => setShowExpenseForm(false)} onSaved={(saved) => { setExpenses((current) => editing ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]); setShowExpenseForm(false); setNotice(editing ? "Expense updated." : "Expense saved."); }} onError={setError} />}
    {canManage && <section><div className="page-heading" style={{ marginTop: 8 }}><div><h2>Budgets</h2><p className="subtitle">Monthly operating limits by category. Leave category as overall workspace budget.</p></div><button className="btn btn-primary" onClick={() => { setEditingBudget(undefined); setShowBudgetForm(true); }}><Plus size={14} />Add budget</button></div><div className="card table-card">{!budgets.length ? <p className="subtitle" style={{ padding: 20 }}>No budgets have been configured.</p> : <table className="table"><thead><tr><th>Month</th><th>Category</th><th>Budget</th><th>Notes</th><th>Actions</th></tr></thead><tbody>{budgets.map((budget) => <tr key={budget.id}><td>{budget.budget_month.slice(0, 7)}</td><td>{label(budget.category)}</td><td>{formatMinor(toMinor(budget.amount), budget.currency)} <span className="task-owner">{budget.currency}</span></td><td>{budget.notes || "—"}</td><td><button className="btn" onClick={() => { setEditingBudget(budget); setShowBudgetForm(true); }}><Pencil size={12} />Edit</button> <button className="btn danger-action" onClick={async () => { if (!window.confirm("Delete this budget?")) return; const ok = await mutate(async () => createClient().from("budgets").delete().eq("id", budget.id), "Budget deleted."); if (ok) setBudgets((current) => current.filter((item) => item.id !== budget.id)); }}><Trash2 size={12} /></button></td></tr>)}</tbody></table>}</div></section>}
    {showBudgetForm && canManage && <BudgetForm budget={editingBudget} currentUserId={currentUserId} onCancel={() => setShowBudgetForm(false)} onSaved={(saved) => { setBudgets((current) => editingBudget ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]); setShowBudgetForm(false); setNotice("Budget saved."); }} onError={setError} />}
  </div>;
}

function Metric({ title, value, note }: { title: string; value: string; note: string }) {
  return <div className="card dashboard-stat"><div className="stat-icon orange"><WalletCards size={17} /></div><div><div className="stat-label">{title}</div><div className="stat-value" style={{ fontSize: 22 }}>{value}</div><div className="stat-meta">{note}</div></div></div>;
}

function ExpenseForm({ expense, currentUserId, tasks, milestones, onCancel, onSaved, onError }: { expense?: Expense; currentUserId: string; tasks: FinanceTask[]; milestones: { id: string; name: string }[]; onCancel: () => void; onSaved: (expense: Expense) => void; onError: (message: string) => void }) {
  const [saving, setSaving] = useState(false); const [validation, setValidation] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setValidation(""); onError("");
    const form = new FormData(event.currentTarget);
    const amount = normalizeAmount(String(form.get("amount") || ""));
    const currency = String(form.get("currency") || "").trim().toUpperCase();
    const vendor = String(form.get("vendor") || "").trim();
    const description = String(form.get("description") || "").trim();
    const expenseDate = String(form.get("expense_date") || "");
    const receiptUrl = String(form.get("receipt_url") || "").trim();
    if (!amount || !/^[A-Z]{3}$/.test(currency) || !vendor || vendor.length > 200 || description.length > 2000 || !/^\d{4}-\d{2}-\d{2}$/.test(expenseDate) || (receiptUrl && !/^https?:\/\/\S+$/i.test(receiptUrl))) {
      setValidation("Enter a positive amount (up to 2 decimals), a 3-letter currency, vendor, valid date, and an http(s) receipt link."); setSaving(false); return;
    }
    const values = { amount, currency, category: String(form.get("category")), vendor, description, expense_date: expenseDate, status: String(form.get("intent") || "draft"), submitted_by: currentUserId, approved_by: null, receipt_url: receiptUrl || null, receipt_path: String(form.get("receipt_path") || "").trim() || null, task_id: String(form.get("task_id") || "") || null, milestone_id: String(form.get("milestone_id") || "") || null };
    try {
      const supabase = createClient();
      const result = expense ? await supabase.from("expenses").update(values).eq("id", expense.id).select().single() : await supabase.from("expenses").insert(values).select().single();
      if (result.error || !result.data) { onError(result.error?.message || "Unable to save expense."); setSaving(false); return; }
      onSaved(result.data as Expense);
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "Unable to save expense.");
    }
    setSaving(false);
  }
  return <form className="card form-card" onSubmit={submit}><div className="section-title"><span>{expense ? "Edit draft expense" : "Add expense"}</span><button type="button" className="icon-button" onClick={onCancel} aria-label="Close"><X size={17} /></button></div><div className="form-grid"><div className="field"><label htmlFor="expense-amount">Amount (Ksh) *</label><input id="expense-amount" name="amount" inputMode="decimal" required defaultValue={expense ? String(expense.amount) : ""} placeholder="0.00" /></div><div className="field"><label htmlFor="expense-currency">Currency</label><input id="expense-currency" name="currency" value={DEFAULT_CURRENCY} readOnly aria-describedby="expense-currency-help" /><span id="expense-currency-help" className="field-help">Kenyan Shillings (Ksh)</span></div><div className="field"><label htmlFor="expense-vendor">Vendor *</label><input id="expense-vendor" name="vendor" maxLength={200} required defaultValue={expense?.vendor} placeholder="Supplier or merchant" /></div><div className="field"><label htmlFor="expense-date">Expense date *</label><input id="expense-date" name="expense_date" type="date" required defaultValue={expense?.expense_date || today} /></div><div className="field"><label htmlFor="expense-category">Category *</label><select id="expense-category" name="category" defaultValue={expense?.category || "materials"}>{categories.map((category) => <option key={category} value={category}>{label(category)}</option>)}</select></div><div className="field"><label htmlFor="expense-task">Task (optional)</label><select id="expense-task" name="task_id" defaultValue={expense?.task_id || ""}><option value="">Not linked</option>{tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></div><div className="field"><label htmlFor="expense-milestone">Milestone (optional)</label><select id="expense-milestone" name="milestone_id" defaultValue={expense?.milestone_id || ""}><option value="">Not linked</option>{milestones.map((milestone) => <option key={milestone.id} value={milestone.id}>{milestone.name}</option>)}</select></div><div className="field"><label htmlFor="expense-receipt">Receipt URL (optional)</label><input id="expense-receipt" name="receipt_url" type="url" defaultValue={expense?.receipt_url || ""} placeholder="https://..." /></div><div className="field full"><label htmlFor="expense-description">Description</label><textarea id="expense-description" name="description" maxLength={2000} defaultValue={expense?.description || ""} placeholder="Business purpose or context" /></div></div>{validation && <p className="form-error" role="alert">{validation}</p>}<div className="form-actions"><button type="button" className="btn" onClick={onCancel}>Cancel</button><button name="intent" value="draft" className="btn" disabled={saving}><Save size={14} />Save draft</button><button name="intent" value="submitted" className="btn btn-primary" disabled={saving}>{saving ? "Saving..." : "Submit for approval"}</button></div></form>;
}

function BudgetForm({ budget, currentUserId, onCancel, onSaved, onError }: { budget?: Budget; currentUserId: string; onCancel: () => void; onSaved: (budget: Budget) => void; onError: (message: string) => void }) {
  const [saving, setSaving] = useState(false); const [validation, setValidation] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setValidation(""); onError("");
    const form = new FormData(event.currentTarget); const amount = normalizeAmount(String(form.get("amount") || "")); const month = String(form.get("budget_month") || ""); const currency = String(form.get("currency") || "").trim().toUpperCase(); const notes = String(form.get("notes") || "").trim(); const category = String(form.get("category") || "") || null;
    if (!amount || !/^\d{4}-\d{2}$/.test(month) || !/^[A-Z]{3}$/.test(currency) || notes.length > 1000) { setValidation("Enter a positive amount, month, 3-letter currency, and notes under 1,000 characters."); setSaving(false); return; }
    const values = { amount, budget_month: `${month}-01`, currency, category, notes, created_by: currentUserId };
    try {
      const supabase = createClient(); const result = budget ? await supabase.from("budgets").update(values).eq("id", budget.id).select().single() : await supabase.from("budgets").insert(values).select().single();
      if (result.error || !result.data) { onError(result.error?.message || "Unable to save budget."); setSaving(false); return; }
      onSaved(result.data as Budget);
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "Unable to save budget.");
    }
    setSaving(false);
  }
  return <form className="card form-card" onSubmit={submit}><div className="section-title"><span>{budget ? "Edit budget" : "Add budget"}</span><button type="button" className="icon-button" onClick={onCancel} aria-label="Close"><X size={17} /></button></div><div className="form-grid"><div className="field"><label htmlFor="budget-month">Month *</label><input id="budget-month" name="budget_month" type="month" required defaultValue={budget?.budget_month.slice(0, 7) || today.slice(0, 7)} /></div><div className="field"><label htmlFor="budget-amount">Amount (Ksh) *</label><input id="budget-amount" name="amount" inputMode="decimal" required defaultValue={budget ? String(budget.amount) : ""} placeholder="0.00" /></div><div className="field"><label htmlFor="budget-currency">Currency</label><input id="budget-currency" name="currency" value={DEFAULT_CURRENCY} readOnly aria-describedby="budget-currency-help" /><span id="budget-currency-help" className="field-help">Kenyan Shillings (Ksh)</span></div><div className="field"><label htmlFor="budget-category">Category</label><select id="budget-category" name="category" defaultValue={budget?.category || ""}><option value="">Overall workspace</option>{categories.map((category) => <option key={category} value={category}>{label(category)}</option>)}</select></div><div className="field full"><label htmlFor="budget-notes">Notes</label><textarea id="budget-notes" name="notes" maxLength={1000} defaultValue={budget?.notes || ""} placeholder="Scope or assumptions for this budget" /></div></div>{validation && <p className="form-error" role="alert">{validation}</p>}<div className="form-actions"><button type="button" className="btn" onClick={onCancel}>Cancel</button><button className="btn btn-primary" disabled={saving}><Save size={14} />{saving ? "Saving..." : "Save budget"}</button></div></form>;
}
