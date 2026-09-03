"use client";

import { useState } from "react";
import { KeyRound, Power } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/browser";

export function UserActions({ user }: { user: { id: string; email: string; is_active: boolean } }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();
  async function toggle() {
    setBusy(true); setMessage("");
    const { error } = await createClient().from("users").update({ is_active: !user.is_active }).eq("id", user.id);
    if (error) setMessage(error.message); else router.refresh();
    setBusy(false);
  }
  async function resetPassword() {
    setBusy(true); setMessage("");
    const response = await fetch("/api/admin/password-reset", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: user.id }) });
    const result = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Reset email sent." : result.error || "Password reset is not configured.");
    setBusy(false);
  }
  return <div className="admin-user-actions"><button className="btn" onClick={toggle} disabled={busy} title={user.is_active ? "Deactivate account" : "Activate account"}><Power size={13} />{user.is_active ? "Deactivate" : "Activate"}</button><button className="btn" onClick={resetPassword} disabled={busy}><KeyRound size={13} />Reset password</button>{message && <span className="stat-label">{message}</span>}</div>;
}
