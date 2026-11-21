"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function TrackLookup() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    const m = v.match(/track\/([A-Za-z0-9_-]{40,64})/) ?? v.match(/^([A-Za-z0-9_-]{40,64})$/);
    if (!m) {
      setError(/^CF-/i.test(v) ? "That's a report reference. Please paste the full tracking link instead." : "That doesn't look like a tracking link. It should contain /track/ followed by a long code.");
      return;
    }
    router.push(`/track/${m[1]}`);
  };
  return (
    <form onSubmit={go} noValidate className="mt-8 space-y-3">
      <label htmlFor="link" className="label">
        Tracking link
      </label>
      <input id="link" className="input" value={value} onChange={(e) => { setValue(e.target.value); setError(""); }} placeholder="https://…/track/…" aria-invalid={Boolean(error)} aria-describedby={error ? "link-error" : undefined} autoComplete="off" />
      {error && (
        <p id="link-error" className="text-sm text-crit">
          {error}
        </p>
      )}
      <button className="btn-dark">Open report</button>
    </form>
  );
}
