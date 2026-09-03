"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Save, SlidersHorizontal, Trash2 } from "lucide-react";
import Link from "next/link";
import { PriorityPill, StatusPill } from "../components/ui";
import { createClient } from "../../lib/supabase/browser";

export type TaskRow = { id: string; title: string; owner: string; status: string; priority: string; due: string; workstream: string; progress: number; tags: string[] };

export function TaskTable({ rows, initialSearch = "" }: { rows: TaskRow[]; initialSearch?: string }) {
  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState("");
  const [owner, setOwner] = useState("");
  const [workstream, setWorkstream] = useState("");
  const [tag, setTag] = useState("");
  const [sort, setSort] = useState("due");
  const [viewName, setViewName] = useState("");
  const [views, setViews] = useState<{ id: string; name: string; filters: Record<string, string> }[]>([]);
  const [viewMessage, setViewMessage] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
  const supabase = useMemo(() => createClient(), []);
  const filtered = useMemo(() => rows.filter(row => {
    const needle = search.toLowerCase().trim();
    return (!needle || `${row.title} ${row.owner} ${row.workstream} ${row.tags.join(" ")}`.toLowerCase().includes(needle)) &&
      (!status || row.status === status) && (!owner || row.owner === owner) && (!workstream || row.workstream === workstream) && (!tag || row.tags.includes(tag));
  }), [rows, search, status, owner, workstream, tag]);
  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    if (sort === "title") return a.title.localeCompare(b.title);
    if (sort === "progress") return b.progress - a.progress;
    if (sort === "priority") return ["critical", "high", "medium", "low"].indexOf(a.priority) - ["critical", "high", "medium", "low"].indexOf(b.priority);
    return (a.due === "No date" ? "9999-12-31" : a.due).localeCompare(b.due === "No date" ? "9999-12-31" : b.due);
  }), [filtered, sort]);
  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await supabase.from("saved_views").select("id,name,filters").eq("resource", "tasks").order("name");
      if (active) setViews((data || []) as unknown as typeof views);
    })();
    return () => { active = false; };
  }, [supabase]);
  async function saveView() {
    if (!viewName.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const result = await supabase.from("saved_views").upsert({ user_id: user.id, resource: "tasks", name: viewName.trim(), filters: { search, status, owner, workstream, tag, sort } }, { onConflict: "user_id,resource,name" }).select("id,name,filters").single();
    if (result.error) setViewMessage("Run migration 003 to enable saved views.");
    else { setViews(current => [...current.filter(view => view.id !== result.data.id), result.data as unknown as typeof views[number]].sort((a, b) => a.name.localeCompare(b.name))); setViewName(""); setViewMessage("View saved."); }
  }
  function applyView(view: typeof views[number]) {
    const filters = view.filters || {};
    setSearch(filters.search || ""); setStatus(filters.status || ""); setOwner(filters.owner || ""); setWorkstream(filters.workstream || ""); setTag(filters.tag || ""); setSort(filters.sort || "due");
  }
  function exportCsv() {
    const header = ["Task","Owner","Status","Priority","Workstream","Due date","Progress"];
    const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const csv = [header, ...filtered.map(row => [row.title,row.owner,row.status,row.priority,row.workstream,row.due,String(row.progress)])].map(row => row.map(escape).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], {type:"text/csv;charset=utf-8"}));
    link.download = "tasks.csv"; link.click(); URL.revokeObjectURL(link.href);
  }
  async function deleteTask(row: TaskRow) {
    if (!window.confirm(`Delete "${row.title}" permanently? This cannot be undone.`)) return;
    setDeletingId(row.id);
    setError("");
    const { data: attachments, error: attachmentQueryError } = await supabase
      .from("task_attachments")
      .select("file_url")
      .eq("task_id", row.id);
    if (attachmentQueryError) {
      setError(attachmentQueryError.message);
      setDeletingId("");
      return;
    }
    const storagePaths = (attachments || [])
      .map((attachment) => attachment.file_url)
      .filter((fileUrl): fileUrl is string => !fileUrl.startsWith("http://") && !fileUrl.startsWith("https://"));
    if (storagePaths.length) {
      const { error: storageError } = await supabase.storage.from("task-attachments").remove(storagePaths);
      if (storageError) {
        setError(storageError.message);
        setDeletingId("");
        return;
      }
    }
    const { error: deleteError } = await supabase.rpc("delete_task_v2", { target_task_id: row.id });
    if (deleteError) {
      setError(deleteError.message);
      setDeletingId("");
      return;
    }
    window.location.reload();
  }
  const owners = Array.from(new Set(rows.map(row => row.owner))).sort();
  const workstreams = Array.from(new Set(rows.map(row => row.workstream))).sort();
  const tags = Array.from(new Set(rows.flatMap(row => row.tags))).sort();
  return <div className="card table-card"><div className="table-tools"><div className="search" style={{width:220}}><span>⌕</span><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search tasks..." aria-label="Search tasks"/></div><select className="filter" value={status} onChange={event=>setStatus(event.target.value)}><option value="">All statuses</option>{["todo","in_progress","review","done"].map(value=><option key={value} value={value}>{value.replace("_"," ")}</option>)}</select><select className="filter" value={owner} onChange={event=>setOwner(event.target.value)}><option value="">All owners</option>{owners.map(value=><option key={value}>{value}</option>)}</select><select className="filter" value={workstream} onChange={event=>setWorkstream(event.target.value)}><option value="">All workstreams</option>{workstreams.map(value=><option key={value}>{value}</option>)}</select><select className="filter" value={tag} onChange={event=>setTag(event.target.value)}><option value="">All tags</option>{tags.map(value=><option key={value}>{value}</option>)}</select><select className="filter" value={sort} onChange={event=>setSort(event.target.value)} aria-label="Sort tasks"><option value="due">Sort: due date</option><option value="title">Sort: title</option><option value="priority">Sort: priority</option><option value="progress">Sort: progress</option></select><button className="btn" style={{marginLeft:"auto"}} onClick={exportCsv}><Download size={14}/>Export CSV</button><span style={{fontSize:11,color:"#8996a2",alignSelf:"center"}}>{sorted.length} shown</span><SlidersHorizontal size={14} style={{display:"none"}}/></div><div className="saved-view-bar"><select className="filter" defaultValue="" onChange={event => { const view = views.find(item => item.id === event.target.value); if (view) applyView(view); }}><option value="">Saved views</option>{views.map(view => <option value={view.id} key={view.id}>{view.name}</option>)}</select><input className="filter" value={viewName} onChange={event => setViewName(event.target.value)} placeholder="Name this view" /><button className="btn" onClick={saveView} disabled={!viewName.trim()}><Save size={13}/>Save view</button>{viewMessage && <span className="stat-label">{viewMessage}</span>}</div>{error && <p className="form-error" role="alert">{error}</p>}{sorted.length ? <table className="table"><thead><tr><th>Task</th><th>Owner</th><th>Status</th><th>Priority</th><th>Workstream</th><th>Due date</th><th>Actions</th></tr></thead><tbody>{sorted.map(row=><tr key={row.id}><td><Link href={`/tasks/${row.id}`}>{row.title}</Link><div style={{height:4,background:"#edf1f5",borderRadius:4,width:110,marginTop:7}}><div style={{height:4,width:`${row.progress}%`,background:"#2878e8",borderRadius:4}}/></div></td><td><span className="avatar" style={{display:"inline-grid",width:24,height:24,fontSize:9,verticalAlign:"middle",marginRight:7}}>{row.owner.split(" ").map(part=>part[0]).join("")}</span>{row.owner}</td><td><StatusPill value={row.status}/></td><td><PriorityPill value={row.priority}/></td><td>{row.workstream}</td><td className={row.priority==="critical"?"due soon":""}>{row.due}</td><td><button className="btn danger-action" onClick={() => deleteTask(row)} disabled={deletingId === row.id} aria-label={`Delete ${row.title}`}><Trash2 size={13}/>{deletingId === row.id ? "Deleting..." : "Delete"}</button></td></tr>)}</tbody></table> : <p className="subtitle" style={{padding:20}}>No tasks match the selected filters.</p>}</div>;
}
