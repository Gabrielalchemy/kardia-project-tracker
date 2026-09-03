"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/browser";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { MilestoneForm } from "./MilestoneForm";
export function MilestonePanel() { const [open, setOpen] = useState(false); return open ? <MilestoneForm onCancel={()=>setOpen(false)}/> : <button className="btn btn-primary" onClick={()=>setOpen(true)}><Plus size={14}/>Add milestone</button>; }

export function MilestoneActions({ milestone }: { milestone: { id: string; name: string; target_date: string; status: string; notes: string | null } }) {
  const [editing, setEditing] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  async function remove() {
    if (!window.confirm(`Delete "${milestone.name}"?`)) return;
    setWorking(true); const { error: deleteError } = await createClient().from("milestones").delete().eq("id", milestone.id);
    if (deleteError) { setError(deleteError.message); setWorking(false); return; }
    router.refresh();
  }
  async function changeStatus(event: React.ChangeEvent<HTMLSelectElement>) {
    setWorking(true); setError("");
    const { error: updateError } = await createClient().from("milestones").update({status: event.target.value}).eq("id", milestone.id);
    if (updateError) setError(updateError.message); else router.refresh();
    setWorking(false);
  }
  if (editing) return <MilestoneForm milestone={milestone} onCancel={() => setEditing(false)}/>;
  return <div style={{display:"flex",gap:6,alignItems:"center",justifyContent:"flex-end"}}><select className="filter" value={milestone.status} onChange={changeStatus} disabled={working} aria-label={`Change ${milestone.name} status`}><option value="planned">Planned</option><option value="in_progress">In progress</option><option value="at_risk">At risk</option><option value="achieved">Achieved</option><option value="missed">Missed</option></select><button className="btn" onClick={() => setEditing(true)} disabled={working} aria-label={`Edit ${milestone.name}`}><Pencil size={13}/></button><button className="btn" onClick={remove} disabled={working} aria-label={`Delete ${milestone.name}`}><Trash2 size={13}/></button>{error&&<span className="form-error">{error}</span>}</div>;
}
