import Link from "next/link";
import { ArrowUpRight, CalendarClock, CheckCircle2, CircleAlert, Clock3, Plus, Target, TrendingUp } from "lucide-react";
import { StatusPill } from "./components/ui";
import { createClient } from "../lib/supabase/server";
import { requireUser } from "../lib/auth";
import { PROJECT_DEADLINE, daysUntilProjectDeadline } from "../lib/project";
import { DashboardExport } from "./components/DashboardExport";

type Task = { id: string; title: string; status: string; priority: string; due_date: string | null; workstream: string; progress_pct: number; owner: { display_name: string } | null };

export default async function Dashboard() {
  const user = await requireUser();
  const supabase = createClient();
  const [{ data: liveTasks }, { data: liveBlockers }, { data: liveUpdates }, { data: profile }, { data: milestones }, { data: activity }, { data: members }] = await Promise.all([
    supabase.from("tasks").select("id,title,status,priority,due_date,workstream,progress_pct,owner:users(display_name)").is("archived_at", null).order("due_date").limit(200),
    supabase.from("blockers").select("id,title,severity,status,owner:users(display_name)").neq("status", "resolved").order("created_at", { ascending: false }).limit(8),
    supabase.from("updates").select("id,date,today,blockers,user:users(display_name)").order("date", { ascending: false }).limit(5),
    supabase.from("users").select("display_name").eq("id", user.id).single(),
    supabase.from("milestones").select("id,name,target_date,status").order("target_date").limit(6),
    supabase.from("audit_logs").select("id,action,entity_type,created_at,metadata,actor:users(display_name)").order("created_at", { ascending: false }).limit(8),
    supabase.from("users").select("id,display_name,is_active").eq("is_active", true).order("display_name"),
  ]);
  const tasks = (liveTasks || []) as unknown as Task[];
  const blockers = (liveBlockers || []).map((blocker) => ({ ...blocker, owner: (blocker.owner as unknown as { display_name: string })?.display_name || "Unassigned" }));
  const updates = (liveUpdates || []).map((update) => ({ ...update, name: (update.user as unknown as { display_name: string })?.display_name || "Teammate" }));
  const complete = tasks.filter((task) => task.status === "done").length;
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const nextWeek = new Date(todayStart);
  nextWeek.setDate(todayStart.getDate() + 7);
  const overdue = tasks.filter((task) => task.due_date && new Date(`${task.due_date}T00:00:00`) < todayStart && task.status !== "done");
  const dueSoon = tasks.filter((task) => task.due_date && new Date(`${task.due_date}T00:00:00`) >= todayStart && new Date(`${task.due_date}T00:00:00`) <= nextWeek).slice(0, 6);
  const progress = tasks.length ? Math.round(tasks.reduce((sum, task) => sum + (task.progress_pct || 0), 0) / tasks.length) : 0;
  const health = Math.max(0, Math.min(100, Math.round(progress - overdue.length * 8 - blockers.filter((blocker) => blocker.severity === "critical").length * 12 + 10)));
  const statusCounts = { todo: tasks.filter((task) => task.status === "todo").length, in_progress: tasks.filter((task) => task.status === "in_progress").length, review: tasks.filter((task) => task.status === "review").length, done: complete };
  const workstreamNames = ["sensors", "conductive_threads", "firmware", "integration", "testing", "demo"];
  const workstreams = workstreamNames.map((name) => {
    const group = tasks.filter((task) => task.workstream === name);
    return [name.replace("_", " "), group.length ? Math.round(group.reduce((sum, task) => sum + (task.progress_pct || 0), 0) / group.length) : 0] as [string, number];
  });
  const workload = (members || []).map((member) => ({ ...member, count: tasks.filter((task) => task.owner?.display_name === member.display_name && task.status !== "done").length })).filter((member) => member.count > 0).sort((a, b) => b.count - a.count).slice(0, 5);
  const daysToDeadline = daysUntilProjectDeadline(today);
  const displayName = profile?.display_name || "there";
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthDays = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const calendarDays = Array.from({ length: monthStart.getDay() + monthDays }, (_, index) => index < monthStart.getDay() ? null : index - monthStart.getDay() + 1);

  return <>
    <div className="dashboard-hero"><div><p className="eyebrow">Project workspace · {today.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</p><h1>Welcome back, {displayName}</h1><p>Keep the next smart clothing prototype moving with a clear view of the work.</p></div><div className="dashboard-actions"><DashboardExport metrics={{ progress, health, overdue: overdue.length, blockers: blockers.length, completed: complete, total: tasks.length }} /><Link href="/tasks/new" className="btn btn-primary"><Plus size={15} />New task</Link></div></div>
    <div className="grid stats-grid dashboard-stat-grid">
      <div className="card dashboard-stat"><div className="stat-icon orange"><Target size={17} /></div><div><div className="stat-label">Overall progress</div><div className="stat-value">{progress}%</div><div className="stat-meta">{complete} of {tasks.length} tasks complete</div></div></div>
      <div className="card dashboard-stat"><div className="stat-icon green"><CheckCircle2 size={17} /></div><div><div className="stat-label">Workspace health</div><div className="stat-value">{health}%</div><div className="stat-meta">{health >= 75 ? "On track" : health >= 50 ? "Needs attention" : "At risk"}</div></div></div>
      <div className="card dashboard-stat"><div className="stat-icon red"><CircleAlert size={17} /></div><div><div className="stat-label">Overdue / blockers</div><div className="stat-value">{overdue.length} <span className="stat-denom">/ {blockers.length}</span></div><div className="stat-meta">{blockers.filter((blocker) => blocker.severity === "critical").length} critical blockers</div></div></div>
      <div className="card dashboard-stat"><div className="stat-icon purple"><Clock3 size={17} /></div><div><div className="stat-label">Days remaining</div><div className="stat-value">{daysToDeadline}</div><div className="stat-meta">Deadline · {new Date(`${PROJECT_DEADLINE}T00:00:00`).toLocaleDateString()}</div></div></div>
    </div>
    <div className="dashboard-main-grid">
      <div className="card dashboard-chart-card"><div className="section-title"><span>Delivery overview</span><Link href="/tasks">View tasks <ArrowUpRight size={12} /></Link></div><div className="chart-heading"><div><div className="stat-label">Task status mix</div><strong>{tasks.length} total tasks</strong></div><span className="chart-legend"><i className="legend-orange" /> Done <i className="legend-muted" /> Remaining</span></div><div className="status-chart"><div className="donut" style={{ "--progress": `${progress}%` } as React.CSSProperties}><div className="donut-center"><strong>{progress}%</strong><span>complete</span></div></div><div className="status-list"><div><span className="status-dot orange-dot" />Done<strong>{statusCounts.done}</strong></div><div><span className="status-dot blue-dot" />In progress<strong>{statusCounts.in_progress}</strong></div><div><span className="status-dot yellow-dot" />In review<strong>{statusCounts.review}</strong></div><div><span className="status-dot gray-dot" />To do<strong>{statusCounts.todo}</strong></div></div></div></div>
      <div className="card calendar-card"><div className="section-title"><span>{today.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span><CalendarClock size={16} /></div><div className="calendar-week">{["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div><div className="calendar-grid">{calendarDays.map((day, index) => <span className={day === today.getDate() ? "calendar-today" : day === 25 && today.getMonth() === 8 ? "calendar-deadline" : ""} key={`${day}-${index}`}>{day || ""}</span>)}</div><div className="calendar-note"><span className="status-dot orange-dot" />Project deadline <strong>25 Sep</strong></div></div>
    </div>
    <div className="dashboard-lower-grid">
      <div className="card"><div className="section-title"><span>Progress by workstream</span><Link href="/tasks">View all <ArrowUpRight size={12} /></Link></div>{workstreams.map(([name, value]) => <div className="progress-row" key={name}><span>{name}</span><div className="progress-track"><div className="progress-fill" style={{ width: `${value}%` }} /></div><span className="progress-number">{value}%</span></div>)}</div>
      <div className="card"><div className="section-title"><span>Upcoming and overdue</span><Link href="/tasks">See all <ArrowUpRight size={12} /></Link></div>{overdue.slice(0, 3).map((task) => <div className="task-line" key={task.id}><CircleAlert size={15} color="#ff6d29" /><div className="task-title">{task.title}<div className="task-owner">{task.owner?.display_name || "Unassigned"}</div></div><span className="due soon">{task.due_date}</span></div>)}{dueSoon.map((task) => <div className="task-line" key={task.id}><div className="task-check" /><div className="task-title">{task.title}<div className="task-owner">{task.owner?.display_name || "Unassigned"}</div></div><span className="due">{task.due_date}</span></div>)}{!overdue.length && !dueSoon.length && <p className="subtitle">No tasks are due in the next 7 days.</p>}</div>
    </div>
    <div className="dashboard-lower-grid">
      <div className="card"><div className="section-title"><span>Workload</span><TrendingUp size={15} /></div>{workload.length ? workload.map((member) => <div className="progress-row" key={member.id}><span>{member.display_name}</span><div className="progress-track"><div className="progress-fill" style={{ width: `${Math.min(100, member.count * 20)}%` }} /></div><span className="progress-number">{member.count}</span></div>) : <p className="subtitle">No active assignments.</p>}</div>
      <div className="card"><div className="section-title"><span>Milestones</span><Link href="/milestones">View all <ArrowUpRight size={12} /></Link></div>{(milestones || []).slice(0, 4).map((milestone) => <div className="task-line" key={milestone.id}><Target size={14} color="#ff9a70" /><div className="task-title">{milestone.name}<div className="task-owner">{milestone.target_date}</div></div><StatusPill value={milestone.status} /></div>)}{!milestones?.length && <p className="subtitle">No milestones have been created yet.</p>}</div>
    </div>
    <div className="dashboard-lower-grid">
      <div className="card"><div className="section-title"><span>Latest activity</span><Link href="/updates">View updates <ArrowUpRight size={12} /></Link></div>{activity?.length ? activity.slice(0, 5).map((item) => <div className="update" key={item.id}><div className="update-head"><strong>{(item.actor as unknown as { display_name: string })?.display_name || "Team member"}</strong><span>{new Date(item.created_at).toLocaleString()}</span></div><p>{item.action} {item.entity_type}</p></div>) : <p className="subtitle">Activity will appear after migration 003 is applied.</p>}</div>
      <div className="card"><div className="section-title"><span>Latest standups</span><Link href="/standup">View all <ArrowUpRight size={12} /></Link></div>{updates.slice(0, 3).map((update) => <div className="update" key={update.id}><div className="update-head"><strong>{update.name}</strong><span>{update.date}</span></div><p>{update.today || "No update text."}</p>{update.blockers && <div style={{ fontSize: 10, color: "#ff9a70", marginTop: 7 }}>Blocker: {update.blockers}</div>}</div>)}{!updates.length && <p className="subtitle">No standup updates have been posted yet.</p>}</div>
    </div>
  </>;
}
