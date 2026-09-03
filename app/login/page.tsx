import { LoginForm } from "./LoginForm";

export default function Login({ searchParams }: { searchParams?: { error?: string } }) {
  const initialError = searchParams?.error === "account_disabled" ? "This account has been deactivated. Contact an administrator." : "";
  return <main className="login-page">
    <div className="login-card">
      <div className="login-brand"><span className="brand-mark" role="img" aria-label="Kardia logo" /><span>Kardia<strong>Project tracker</strong></span></div>
      <div className="login-heading"><span className="login-kicker">Private team workspace</span><h1>Welcome back</h1><p>Sign in with the email and password provided by your administrator.</p></div>
      <LoginForm initialError={initialError} />
      <div className="login-help"><LockIcon /><span>Access is managed by an administrator. Contact them if you need an account or cannot sign in.</span></div>
    </div>
  </main>;
}

function LockIcon() {
  return <span className="login-help-icon" aria-hidden="true">i</span>;
}
