"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Save, Trash2, X } from "lucide-react";
import { createClient } from "../../lib/supabase/browser";

type Blocker = { id: string; title: string; description: string; severity: string; status: string; target_fix_date: string | null };

export function BlockerActions({ blocker }: { blocker: Blocker }) {
  const [editing, setEditing] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setWorking(true); setError("");
    const form = new FormData(event.currentTarget);
    const { error: updateError } = await createClient().from("blockers").update({title:String(form.get("title")||"").trim(),description:String(form.get("description")||"").trim()||null,severity:String(form.get("severity")),status:String(form.get("status")),target_fix_date:form.get("target_fix_date")||null}).eq("id", blocker.id);
    if (updateError) { setError(updateError.message); setWorking(false); return; }
    setEditing(false); setWorking(false); router.refresh();
  }
  async function remove() {
    if (!window.confirm(`Delete "${blocker.title}"?`)) return;
    setWorking(true); const { error: deleteError } = await createClient().from("blockers").delete().eq("id", blocker.id);
    if (deleteError) { setError(deleteError.message); setWorking(false); return; }
    router.refresh();
  }
  if (editing) return <form onSubmit={save} className="card form-card" style={{marginTop:12}}><div className="form-grid"><div className="field full"><label>Title *</label><input name="title" required defaultValue={blocker.title}/></div><div className="field full"><label>Details</label><textarea name="description" defaultValue={blocker.description}/></div><div className="field"><label>Severity</label><select name="severity" defaultValue={blocker.severity}><option>low</option><option>medium</option><option>high</option><option>critical</option></select></div><div className="field"><label>Status</label><select name="status" defaultValue={blocker.status}><option>open</option><option>mitigating</option><option>resolved</option></select></div><div className="field"><label>Target fix date</label><input name="target_fix_date" type="date" defaultValue={blocker.target_fix_date||""}/></div></div>{error&&<p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button type="button" className="btn" onClick={()=>setEditing(false)}><X size={14}/>Cancel</button><button className="btn btn-primary" disabled={working}><Save size={14}/>{working?"Saving...":"Save changes"}</button></div></form>;
  return <div style={{display:"flex",gap:6,justifyContent:"flex-end",alignItems:"center"}}><button className="btn" onClick={()=>setEditing(true)} disabled={working} aria-label={`Edit ${blocker.title}`}><Pencil size={13}/></button><button className="btn" onClick={remove} disabled={working} aria-label={`Delete ${blocker.title}`}><Trash2 size={13}/></button>{error&&<span className="form-error">{error}</span>}</div>;
}
