"use client";
import { useEffect, useRef, useState } from "react";

export function CitizenLogin({ next }: { next: string }) {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [masked, setMasked] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError("");
    if (!/^[6-9]\d{9}$/.test(phone.replace(/\D/g, "").slice(-10)) || phone.replace(/\D/g, "").length < 10) return setError("Enter a valid 10-digit mobile number.");
    setBusy(true);
    try {
      const res = await fetch("/api/citizen/otp/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't send the code.");
      setMasked(data.phone);
      setDevCode(data.devCode ?? "");
      setStep("code");
      setCooldown(30);
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!/^\d{6}$/.test(code)) return setError("Enter the 6-digit code.");
    setBusy(true);
    try {
      const res = await fetch("/api/citizen/otp/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, code }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't verify the code.");
      window.location.assign(next);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return step === "phone" ? (
    <form onSubmit={send} noValidate className="mt-8 space-y-4">
      <div>
        <label htmlFor="phone" className="label">
          Mobile number
        </label>
        <div className={`flex h-12 items-center overflow-hidden rounded-xl border bg-surface ${error ? "border-crit" : "border-line-strong"} focus-within:border-ink`}>
          <span className="flex h-full items-center border-r border-line bg-paper px-3 text-[15px] text-ink-2">🇮🇳 +91</span>
          <input
            id="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={14}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="98123 45678"
            className="h-full flex-1 bg-transparent px-3 text-[16px] tracking-wide outline-none"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "phone-error" : "phone-hint"}
          />
        </div>
        {error ? (
          <p id="phone-error" role="alert" className="mt-1.5 text-sm text-crit">
            {error}
          </p>
        ) : (
          <p id="phone-hint" className="mt-1.5 hint">
            We&apos;ll send a 6-digit code by SMS. Indian numbers only.
          </p>
        )}
      </div>
      <button className="btn h-12 w-full bg-ink text-white hover:bg-ink-2" disabled={busy}>
        {busy ? "Sending code…" : "Send code"}
      </button>
    </form>
  ) : (
    <form onSubmit={verify} noValidate className="mt-8 space-y-4">
      <p className="text-ink-2">
        Enter the code sent to <strong className="text-ink">{masked}</strong>.{" "}
        <button type="button" className="underline underline-offset-2" onClick={() => { setStep("phone"); setCode(""); setError(""); }}>
          Change
        </button>
      </p>
      {devCode && (
        <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent-ink" role="status">
          Demo mode — no SMS is sent. Your code is <strong className="font-mono">{devCode}</strong>
        </p>
      )}
      <div>
        <label htmlFor="code" className="label">
          6-digit code
        </label>
        <input
          ref={codeRef}
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className="input h-12 text-center font-mono text-[22px] tracking-[0.5em]"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "code-error" : undefined}
        />
        {error && (
          <p id="code-error" role="alert" className="mt-1.5 text-sm text-crit">
            {error}
          </p>
        )}
      </div>
      <button className="btn h-12 w-full bg-ink text-white hover:bg-ink-2" disabled={busy}>
        {busy ? "Checking…" : "Verify and sign in"}
      </button>
      <button type="button" disabled={cooldown > 0 || busy} onClick={() => send()} className="w-full text-sm text-ink-2 underline underline-offset-2 disabled:no-underline disabled:opacity-50">
        {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
      </button>
    </form>
  );
}
