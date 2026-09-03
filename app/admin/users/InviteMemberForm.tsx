"use client";

import { useState } from "react";
import { Mail, Send, X } from "lucide-react";

export function InviteMemberForm({ onCancel }: { onCancel: () => void }) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    const response = await fetch("/api/admin/invite", { method: "POST", headers: {"content-type":"application/json"}, body: JSON.stringify({email, displayName}) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setError(result.error || "Unable to send invitation."); setSaving(false); return; }
    setMessage(`Invitation sent to ${email}.`);
    setEmail(""); setDisplayName(""); setSaving(false);
  }
  return <form className="card form-card" onSubmit={submit} style={{marginBottom:16}}><div className="section-title">Invite a team member</div><div className="form-grid"><div className="field full"><label>Email *</label><div style={{display:"flex",alignItems:"center",gap:8}}><Mail size={15}/><input style={{flex:1}} type="email" required value={email} onChange={event=>setEmail(event.target.value)} placeholder="teammate@company.com"/></div></div><div className="field full"><label>Display name</label><input value={displayName} onChange={event=>setDisplayName(event.target.value)} placeholder="Optional name shown in the workspace"/></div></div>{error&&<p className="form-error" role="alert">{error}</p>}{message&&<p style={{color:"#86efac",fontSize:12}} role="status">{message}</p>}<div className="form-actions"><button type="button" className="btn" onClick={onCancel}><X size={14}/>Close</button><button className="btn btn-primary" disabled={saving}><Send size={14}/>{saving?"Sending...":"Send invitation"}</button></div></form>;
}
