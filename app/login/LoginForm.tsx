"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound, LockKeyhole, Mail } from "lucide-react";
import { createClient } from "../../lib/supabase/browser";

export function LoginForm({ initialError = "" }: { initialError?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true); setError("");
    const { error: signInError } = await createClient().auth.signInWithPassword({ email, password });
    if (signInError) { setError(signInError.message); setLoading(false); return; }
    router.replace("/"); router.refresh();
  }
  return <form className="login-form" onSubmit={submit}>
    <div className="login-field">
      <label htmlFor="login-email">Email address</label>
      <div className="login-input-wrap"><Mail size={16}/><input id="login-email" name="email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" /></div>
    </div>
    <div className="login-field">
      <label htmlFor="login-password">Password</label>
      <div className="login-input-wrap"><KeyRound size={16}/><input id="login-password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password"/><button type="button" className="login-password-toggle" onClick={()=>setShowPassword(value=>!value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div>
    </div>
    {error && <p className="login-error" role="alert">{error}</p>}
    <button className="btn btn-primary login-submit" disabled={loading}><LockKeyhole size={15}/>{loading ? "Checking your details..." : "Sign in to workspace"}</button>
  </form>;
}
