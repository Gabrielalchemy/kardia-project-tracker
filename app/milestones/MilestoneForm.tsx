"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { createClient } from "../../lib/supabase/browser";

type Milestone = { id: string; name: string; target_date: string; status: string; notes: string | null };

export function MilestoneForm({ onCancel, milestone }: { onCancel: () => void; milestone?: Milestone }) {
  const router = useRouter(); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    const values = { name: String(form.get("name") || "").trim(), target_date: String(form.get("target_date")), status: String(form.get("status")), notes: String(form.get("notes") || "").trim() || null };
    const result = milestone ? await createClient().from("milestones").update(values).eq("id", milestone.id) : await createClient().from("milestones").insert(values);
    if (result.error) { setError(result.error.message); setSaving(false); return; }
    onCancel(); router.refresh();
  }
  return <form className="card form-card milestone-form" onSubmit={submit}><div className="section-title">{milestone ? "Edit milestone" : "Add milestone"}</div><div className="form-grid"><div className="field full"><label htmlFor="milestone-name">Milestone name *</label><input id="milestone-name" name="name" required defaultValue={milestone?.name} placeholder="e.g. Prototype v1 ready for testing" /></div><div className="field"><label htmlFor="milestone-date">Target date *</label><input id="milestone-date" name="target_date" type="date" required defaultValue={milestone?.target_date} /></div><div className="field"><label htmlFor="milestone-status">Status</label><select id="milestone-status" name="status" defaultValue={milestone?.status || "planned"}><option value="planned">Planned</option><option value="in_progress">In progress</option><option value="at_risk">At risk</option><option value="achieved">Achieved</option><option value="missed">Missed</option></select></div><div className="field full"><label htmlFor="milestone-notes">Notes</label><textarea id="milestone-notes" name="notes" defaultValue={milestone?.notes || ""} placeholder="Add success criteria, dependencies, or context..." /></div></div>{error&&<p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button type="button" className="btn" onClick={onCancel}>Cancel</button><button className="btn btn-primary" disabled={saving}><Save size={14}/>{saving?"Saving...":"Save milestone"}</button></div></form>;
}
