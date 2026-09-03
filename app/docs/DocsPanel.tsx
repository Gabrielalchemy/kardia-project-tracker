"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, Pencil, Save, Trash2, X } from "lucide-react";
import { createClient } from "../../lib/supabase/browser";

type Doc = { id: string; title: string; type: string; description: string; url: string; linked_task_id: string | null };
type Task = { id: string; title: string };

function DocForm({ doc, tasks, onCancel }: { doc?: Doc; tasks: Task[]; onCancel: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    const values = { title: String(form.get("title") || "").trim(), type: String(form.get("type")), description: String(form.get("description") || "").trim() || null, url: String(form.get("url") || "").trim(), linked_task_id: String(form.get("linked_task_id") || "") || null };
    const supabase = createClient();
    const result = doc ? await supabase.from("docs").update(values).eq("id", doc.id) : await supabase.from("docs").insert(values);
    if (result.error) { setError(result.error.message); setSaving(false); return; }
    onCancel(); setSaving(false); router.refresh();
  }
  return <form className="card form-card" onSubmit={submit} style={{marginBottom:16}}><div className="section-title">{doc ? "Edit document" : "Add document"}</div><div className="form-grid">
    <div className="field full"><label>Title *</label><input name="title" required defaultValue={doc?.title} placeholder="e.g. Architecture overview"/></div>
    <div className="field"><label>Type</label><select name="type" defaultValue={doc?.type || "other"}><option value="architecture">Architecture</option><option value="bom">Bill of materials</option><option value="assembly">Assembly</option><option value="test_plan">Test plan</option><option value="other">Other</option></select></div>
    <div className="field"><label>Linked task</label><select name="linked_task_id" defaultValue={doc?.linked_task_id || ""}><option value="">No linked task</option>{tasks.map(task=><option key={task.id} value={task.id}>{task.title}</option>)}</select></div>
    <div className="field full"><label>URL *</label><input name="url" type="url" required defaultValue={doc?.url} placeholder="https://..."/></div>
    <div className="field full"><label>Description</label><textarea name="description" defaultValue={doc?.description} placeholder="What does this document cover?"/></div>
  </div>{error&&<p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button type="button" className="btn" onClick={onCancel}><X size={14}/>Cancel</button><button className="btn btn-primary" disabled={saving}><Save size={14}/>{saving?"Saving...":"Save document"}</button></div></form>;
}

export function DocsPanel({ tasks }: { tasks: Task[] }) {
  const [open, setOpen] = useState(false);
  return open ? <DocForm tasks={tasks} onCancel={() => setOpen(false)}/> : <button className="btn btn-primary" onClick={() => setOpen(true)}><FilePlus2 size={14}/>Add document</button>;
}

export function DocActions({ doc, tasks }: { doc: Doc; tasks: Task[] }) {
  const [editing, setEditing] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  async function remove() {
    if (!window.confirm(`Delete "${doc.title}"?`)) return;
    setWorking(true); setError("");
    const { error: deleteError } = await createClient().from("docs").delete().eq("id", doc.id);
    if (deleteError) { setError(deleteError.message); setWorking(false); return; }
    router.refresh();
  }
  if (editing) return <DocForm doc={doc} tasks={tasks} onCancel={() => setEditing(false)}/>;
  return <div style={{display:"flex",gap:6,alignItems:"center"}}><button className="btn" onClick={() => setEditing(true)} disabled={working} aria-label={`Edit ${doc.title}`}><Pencil size={13}/></button><button className="btn" onClick={remove} disabled={working} aria-label={`Delete ${doc.title}`}><Trash2 size={13}/></button>{error&&<span className="form-error">{error}</span>}</div>;
}
