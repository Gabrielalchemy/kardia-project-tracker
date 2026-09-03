"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Pencil, Save, Trash2, X } from "lucide-react";
import { createClient } from "../../../lib/supabase/browser";

type Member = { id: string; display_name: string };
type Task = { id: string; title: string; description: string; status: string; priority: string; due_date: string | null; workstream: string; progress_pct: number; owner_id: string; tags?: string[] };

export function TaskEditPanel({ task, members }: { task: Task; members: Member[] }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const { error: updateError } = await createClient().from("tasks").update({
      title: String(form.get("title") || "").trim(),
      description: String(form.get("description") || ""),
      owner_id: String(form.get("owner_id")),
      status: String(form.get("status")),
      priority: String(form.get("priority")),
      workstream: String(form.get("workstream")),
      due_date: form.get("due_date") || null,
      progress_pct: Number(form.get("progress_pct") || 0),
      tags: String(form.get("tags") || "").split(",").map(value => value.trim()).filter(Boolean),
    }).eq("id", task.id);
    if (updateError) { setError(updateError.message); setSaving(false); return; }
    setEditing(false);
    setSaving(false);
    router.refresh();
  }
  async function archiveTask() {
    if (!window.confirm(`Archive "${task.title}"? It will be hidden from active task lists.`)) return;
    setSaving(true); setError("");
    const { error: archiveError } = await createClient().from("tasks").update({ archived_at: new Date().toISOString() }).eq("id", task.id);
    if (archiveError) { setError(archiveError.message); setSaving(false); return; }
    router.push("/tasks"); router.refresh();
  }
  async function deleteTask() {
    if (!window.confirm(`Delete "${task.title}" permanently? This cannot be undone.`)) return;
    setSaving(true); setError("");
    const supabase = createClient();
    const { data: attachments, error: attachmentQueryError } = await supabase
      .from("task_attachments")
      .select("file_url")
      .eq("task_id", task.id);
    if (attachmentQueryError) {
      setError(attachmentQueryError.message);
      setSaving(false);
      return;
    }
    const storagePaths = (attachments || [])
      .map((attachment) => attachment.file_url)
      .filter((fileUrl): fileUrl is string => !fileUrl.startsWith("http://") && !fileUrl.startsWith("https://"));
    if (storagePaths.length) {
      const { error: storageError } = await supabase.storage.from("task-attachments").remove(storagePaths);
      if (storageError) {
        setError(storageError.message);
        setSaving(false);
        return;
      }
    }
    const { error: deleteError } = await supabase.rpc("delete_task_v2", { target_task_id: task.id });
    if (deleteError) { setError(deleteError.message); setSaving(false); return; }
    router.push("/tasks"); router.refresh();
  }

  if (!editing) return <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button className="btn btn-primary" onClick={() => setEditing(true)}><Pencil size={14}/>Edit task</button><button className="btn" onClick={archiveTask} disabled={saving}><Archive size={14}/>Archive task</button><button className="btn danger-action" onClick={deleteTask} disabled={saving}><Trash2 size={14}/>Delete task</button>{error&&<span className="form-error" role="alert">{error}</span>}</div>;
  return <form className="card form-card" onSubmit={submit} style={{marginBottom: 16}}><div className="section-title">Edit task</div><div className="form-grid">
    <div className="field full"><label>Task title *</label><input name="title" required maxLength={200} defaultValue={task.title}/></div>
    <div className="field full"><label>Description</label><textarea name="description" maxLength={10000} defaultValue={task.description}/></div>
    <div className="field"><label>Owner</label><select name="owner_id" defaultValue={task.owner_id}>{members.map(member=><option key={member.id} value={member.id}>{member.display_name}</option>)}</select></div>
    <div className="field"><label>Status</label><select name="status" defaultValue={task.status}><option value="todo">To do</option><option value="in_progress">In progress</option><option value="review">Review</option><option value="done">Done</option></select></div>
    <div className="field"><label>Priority</label><select name="priority" defaultValue={task.priority}><option>low</option><option>medium</option><option>high</option><option>critical</option></select></div>
    <div className="field"><label>Workstream</label><select name="workstream" defaultValue={task.workstream}><option>sensors</option><option>firmware</option><option>conductive_threads</option><option>integration</option><option>testing</option><option>demo</option><option>docs</option><option>other</option></select></div>
    <div className="field"><label>Due date</label><input name="due_date" type="date" defaultValue={task.due_date || ""}/></div>
    <div className="field"><label>Progress %</label><input name="progress_pct" type="number" min="0" max="100" defaultValue={task.progress_pct}/></div>
    <div className="field full"><label>Tags</label><input name="tags" defaultValue={(task.tags || []).join(", ")} placeholder="hardware, prototype (comma separated)"/></div>
  </div>{error&&<p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button type="button" className="btn" onClick={()=>setEditing(false)}><X size={14}/>Cancel</button><button className="btn btn-primary" disabled={saving}><Save size={14}/>{saving?"Saving...":"Save changes"}</button></div></form>;
}
