"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Megaphone, Save } from "lucide-react";
import { createClient } from "../../lib/supabase/browser";

export function AnnouncementForm() {
  const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const router = useRouter();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const form = new FormData(event.currentTarget); const { data: { user } } = await createClient().auth.getUser();
    if (!user) { setError("Your session has expired. Please sign in again."); setSaving(false); return; }
    const { error: resultError } = await createClient().from("announcements").insert({ author_id: user.id, title: String(form.get("title") || "").trim(), body: String(form.get("body") || "").trim(), expires_at: form.get("expires_at") || null });
    if (resultError) setError(resultError.message); else { event.currentTarget.reset(); router.refresh(); }
    setSaving(false);
  }
  return <form className="card form-card" onSubmit={submit}><div className="section-title"><span><Megaphone size={15} style={{ verticalAlign: "middle", marginRight: 7 }} />Publish announcement</span></div><div className="form-grid"><div className="field full"><label>Title *</label><input name="title" required maxLength={160} /></div><div className="field full"><label>Message *</label><textarea name="body" required maxLength={10000} /></div><div className="field"><label>Expires (optional)</label><input name="expires_at" type="datetime-local" /></div></div>{error && <p className="form-error" role="alert">{error}</p>}<button className="btn btn-primary" disabled={saving}><Save size={14} />{saving ? "Publishing…" : "Publish"}</button></form>;
}
