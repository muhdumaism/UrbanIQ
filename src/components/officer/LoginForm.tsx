"use client";
import { useState } from "react";

const DEMO = [
  { email: "supervisor@civicflow.demo", label: "Supervisor — all departments" },
  { email: "roads@civicflow.demo", label: "Roads Maintenance officer" },
  { email: "electrical@civicflow.demo", label: "Electrical Response officer" },
];

export function LoginForm({ next, demo }: { next: string; demo: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fe: typeof fieldErrors = {};
    if (!email.trim()) fe.email = "Enter your email.";
    if (!password) fe.password = "Enter your password.";
    setFieldErrors(fe);
    if (Object.keys(fe).length) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Sign-in failed.");
      window.location.assign(next);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <>
      <form onSubmit={submit} noValidate className="mt-8 space-y-4">
        {error && (
          <p role="alert" className="rounded-xl border border-[#e7b7b5] bg-crit-soft px-4 py-3 text-sm text-crit">
            {error}
          </p>
        )}
        <div>
          <label htmlFor="email" className="label">
            Work email
          </label>
          <input id="email" type="email" autoComplete="username" className="input" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? "email-error" : undefined} />
          {fieldErrors.email && <p id="email-error" className="mt-1.5 text-sm text-crit">{fieldErrors.email}</p>}
        </div>
        <div>
          <label htmlFor="password" className="label">
            Password
          </label>
          <input id="password" type="password" autoComplete="current-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? "password-error" : undefined} />
          {fieldErrors.password && <p id="password-error" className="mt-1.5 text-sm text-crit">{fieldErrors.password}</p>}
        </div>
        <button className="btn-dark w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      {demo && (
        <section aria-labelledby="demo-accounts" className="mt-8 rounded-2xl border border-dashed border-line-strong p-5">
          <h2 id="demo-accounts" className="text-sm font-semibold">
            Demo accounts <span className="font-normal text-muted">(demo mode only)</span>
          </h2>
          <p className="mt-1 text-sm text-muted">
            Password for all: <code className="font-mono text-ink">civicflow-demo</code>
          </p>
          <ul className="mt-3 space-y-2">
            {DEMO.map((d) => (
              <li key={d.email} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  <span className="block font-medium">{d.label}</span>
                  <span className="font-mono text-xs text-muted">{d.email}</span>
                </span>
                <button type="button" className="btn-outline btn-sm" onClick={() => { setEmail(d.email); setPassword("civicflow-demo"); }}>
                  Use
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
