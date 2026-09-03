"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, Save, X } from "lucide-react";
import { createClient } from "../../lib/supabase/browser";

export function BlockerPanel() {
  const [open,setOpen]=useState(false); const [saving,setSaving]=useState(false); const [error,setError]=useState(""); const router=useRouter();
  async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();setSaving(true);setError("");const f=new FormData(event.currentTarget);const {data:{user}}=await createClient().auth.getUser();if(!user){router.push("/login");return;}const {error:err}=await createClient().from("blockers").insert({title:f.get("title"),description:f.get("description"),severity:f.get("severity"),status:"open",owner_id:user.id,target_fix_date:f.get("target_fix_date")||null});if(err){setError(err.message);setSaving(false);return;}setOpen(false);router.refresh();}
  if(!open)return <button className="btn btn-primary" onClick={()=>setOpen(true)}><CircleAlert size={14}/>Log blocker</button>;
  return <form className="card form-card inline-action-form" onSubmit={submit}><div className="section-title">Log blocker</div><div className="form-grid"><div className="field full"><label htmlFor="blocker-title">Title *</label><input id="blocker-title" name="title" required placeholder="What is blocking progress?" /></div><div className="field full"><label htmlFor="blocker-description">Details</label><textarea id="blocker-description" name="description" placeholder="Explain the impact and what support is needed..." /></div><div className="field"><label htmlFor="blocker-severity">Severity</label><select id="blocker-severity" name="severity"><option value="medium">Medium</option><option value="low">Low</option><option value="high">High</option><option value="critical">Critical</option></select></div><div className="field"><label htmlFor="blocker-date">Target fix date</label><input id="blocker-date" name="target_fix_date" type="date"/></div></div>{error&&<p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button type="button" className="btn" onClick={()=>setOpen(false)}><X size={14}/>Cancel</button><button className="btn btn-primary" disabled={saving}><Save size={14}/>{saving?"Saving...":"Save blocker"}</button></div></form>;
}
