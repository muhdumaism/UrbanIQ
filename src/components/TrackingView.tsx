"use client";
import { useCallback, useEffect, useState } from "react";
import type { TrackingView as View } from "@/lib/citizen";
import { formatDateTime } from "@/lib/format";
import { MiniMap } from "./map/MiniMap";
import { EMPTY_LOCATION, type PickedLocation } from "./map/location-types";
import { LocationField as LocationPicker } from "./map/LocationField";


const STEPS = [
  { key: "RECEIVED", label: "Received" },
  { key: "ACKNOWLEDGED", label: "Acknowledged" },
  { key: "IN_PROGRESS", label: "In progress" },
  { key: "RESOLVED", label: "Resolved" },
] as const;

function stepIndex(v: View) {
  const s = v.ticket?.status;
  if (s === "RESOLVED") return 3;
  if (s === "IN_PROGRESS") return 2;
  if (s === "ACKNOWLEDGED") return 1;
  return 0;
}

export function TrackingView({ initial, token, link, isNew }: { initial: View; token: string; link: string; isNew: boolean }) {
  const [view, setView] = useState(initial);
  const [copied, setCopied] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [editingLocation, setEditingLocation] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/track/${token}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      setView(await res.json());
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, [token]);

  useEffect(() => {
    const id = setInterval(refresh, view.processing ? 2500 : 30000);
    return () => clearInterval(id);
  }, [refresh, view.processing]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard blocked: the link is visible to copy manually */
    }
  };

  const openRequests = view.infoRequests.filter((r) => r.status === "OPEN");
  const idx = stepIndex(view);

  return (
    <div className="space-y-6">
      {isNew && (
        <div className="rounded-2xl border border-[#b9d36a] bg-accent-soft p-5" role="status">
          <p className="text-sm font-medium text-accent-ink">Report received — thank you.</p>
          <p className="mt-1 text-ink-2">Save this private link to check progress. Anyone with the link can see this report&apos;s status, so share it carefully.</p>
        </div>
      )}

      <header>
        <p className="eyebrow">Your report</p>
        <h1 className="mt-2 flex flex-wrap items-baseline gap-x-3 text-3xl font-semibold tracking-tight">
          <span className="font-mono">{view.reference}</span>
          {view.ticket && <span className="text-base font-normal text-muted">ticket {view.ticket.reference}</span>}
        </h1>
        <p className="mt-1 text-sm text-muted">Sent {formatDateTime(view.submittedAt)}</p>
      </header>

      <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <label htmlFor="track-link" className="sr-only">
          Private tracking link
        </label>
        <input id="track-link" readOnly value={link} className="input font-mono text-sm" onFocus={(e) => e.currentTarget.select()} />
        <button type="button" onClick={copy} className="btn-dark btn-sm shrink-0">
          {copied ? "Copied ✓" : "Copy link"}
        </button>
        <span aria-live="polite" className="sr-only">
          {copied ? "Link copied" : ""}
        </span>
      </div>

      {loadError && (
        <div role="alert" className="flex items-center justify-between rounded-xl border border-[#ecd894] bg-med-soft px-4 py-3 text-sm text-med">
          Couldn&apos;t refresh the latest status.
          <button className="btn-outline btn-sm" onClick={refresh}>
            Retry
          </button>
        </div>
      )}

      {/* Status */}
      <section aria-labelledby="h-status" className="card p-5 sm:p-6">
        <h2 id="h-status" className="text-lg font-semibold tracking-tight">
          Status
        </h2>
        {view.processing ? (
          <div className="mt-4 flex items-center gap-3" role="status" aria-live="polite">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-accent-hover" />
            </span>
            <p>We&apos;re reading your report and routing it to the right team. This usually takes a few seconds.</p>
          </div>
        ) : (
          <>
            <p className="mt-1 text-ink-2" aria-live="polite">
              {view.ticket?.statusLabel ?? "Received"}
              {view.ticket?.department && (
                <>
                  {" · "}
                  <span className="font-medium text-ink">{view.ticket.department}</span>
                </>
              )}
            </p>
            <ol className="mt-5 grid grid-cols-4 gap-2" aria-label="Progress">
              {STEPS.map((s, i) => (
                <li key={s.key} className="min-w-0">
                  <div className={`h-1.5 rounded-full ${i <= idx ? "bg-ink" : "bg-line"}`} />
                  <p className={`mt-2 truncate text-xs sm:text-sm ${i <= idx ? "font-medium text-ink" : "text-muted"}`}>
                    {s.label}
                    {i === idx && <span className="sr-only"> (current)</span>}
                  </p>
                </li>
              ))}
            </ol>
            {view.ticket?.resolutionNote && (
              <p className="mt-5 rounded-xl bg-paper px-4 py-3 text-sm">
                <span className="font-medium">Resolution: </span>
                {view.ticket.resolutionNote}
              </p>
            )}
          </>
        )}
      </section>

      {/* Requests for the citizen */}
      {openRequests.map((r) => (
        <InfoRequestCard key={r.id} request={r} token={token} onDone={refresh} />
      ))}

      <div className="grid gap-6 md:grid-cols-2">
        <section aria-labelledby="h-summary" className="card p-5 sm:p-6">
          <h2 id="h-summary" className="text-lg font-semibold tracking-tight">
            What you reported
          </h2>
          {view.summary && (
            <p className="mt-2 font-medium">
              {view.summary}
              {view.issueType && <span className="block text-sm font-normal text-muted">{view.category} · {view.issueType}</span>}
            </p>
          )}
          {view.text ? <blockquote className="mt-3 border-l-2 border-line-strong pl-3 text-ink-2">{view.text}</blockquote> : <p className="mt-3 text-muted">No description — photo only.</p>}
          <p className="mt-3 text-sm text-muted">{view.hasPhoto ? "📷 Photo attached (visible to city officers only)" : "No photo attached"}</p>
        </section>

        <section aria-labelledby="h-loc" className="card overflow-hidden">
          <div className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <h2 id="h-loc" className="text-lg font-semibold tracking-tight">
                Location
              </h2>
              {!editingLocation && view.ticket?.status !== "RESOLVED" && (
                <button className="btn-outline btn-sm" onClick={() => setEditingLocation(true)}>
                  Correct location
                </button>
              )}
            </div>
            <p className="mt-2">{view.location.text || (view.location.lat != null ? "Pinned on the map" : <span className="text-muted">No location given yet</span>)}</p>
            {view.location.ward && <p className="text-sm text-muted">{view.location.ward}</p>}
          </div>
          {view.location.lat != null && view.location.lng != null && !editingLocation && (
            <MiniMap className="h-44 w-full" lat={view.location.lat} lng={view.location.lng} label={`Map showing your pin${view.location.ward ? ` in ${view.location.ward}` : ""}`} />
          )}
        </section>
      </div>

      {editingLocation && <LocationEditor token={token} initial={view} onCancel={() => setEditingLocation(false)} onDone={() => { setEditingLocation(false); refresh(); }} />}

      {view.ticket && view.ticket.timeline.length > 0 && (
        <section aria-labelledby="h-timeline" className="card p-5 sm:p-6">
          <h2 id="h-timeline" className="text-lg font-semibold tracking-tight">
            Updates
          </h2>
          <ol className="mt-4 space-y-4">
            {[...view.ticket.timeline].reverse().map((e) => (
              <li key={e.id} className="grid grid-cols-[auto_1fr] gap-3">
                <span className="mt-1.5 h-2 w-2 rounded-full bg-ink" aria-hidden="true" />
                <div>
                  <p>{e.message}</p>
                  <p className="text-sm text-muted">{formatDateTime(e.at)}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function InfoRequestCard({ request, token, onDone }: { request: View["infoRequests"][number]; token: string; onDone: () => void }) {
  const [answer, setAnswer] = useState("");
  const [loc, setLoc] = useState<PickedLocation>(EMPTY_LOCATION);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showMap, setShowMap] = useState(false);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const pinned = loc.lat != null && loc.lng != null;
    if (pinned && !loc.confirmed) return setError("Confirm the pin, or remove it.");
    if (!answer.trim() && !pinned && !loc.text.trim()) return setError(request.kind === "LOCATION" ? "Type a street or landmark, or drop a pin." : "Please write a short answer.");
    setBusy(true);
    setError("");
    const body: Record<string, unknown> = { infoRequestId: request.id };
    if (answer.trim()) body.answer = answer.trim();
    if (pinned || loc.text.trim()) body.location = { ...(pinned ? { lat: loc.lat, lng: loc.lng, placeId: loc.placeId ?? undefined } : {}), text: loc.text.trim() || undefined, source: loc.source === "DEVICE" ? "DEVICE" : pinned ? "PIN" : "LANDMARK" };
    try {
      const res = await fetch(`/api/track/${token}/reply`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't send your answer.");
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby={`q-${request.id}`} className="rounded-2xl border-2 border-ink bg-surface p-5 sm:p-6">
      <p className="eyebrow text-ink">The city needs a detail from you</p>
      <h2 id={`q-${request.id}`} className="mt-2 text-xl font-semibold tracking-tight">
        {request.question}
      </h2>
      <form onSubmit={send} noValidate className="mt-4 space-y-4">
        {request.kind === "LOCATION" ? (
          <>
            {showMap ? (
              <LocationPicker value={loc} onChange={setLoc} idPrefix={`req-${request.id}`} error={error || undefined} />
            ) : (
              <div>
                <label htmlFor={`a-${request.id}`} className="label">
                  Street or nearby landmark
                </label>
                <input id={`a-${request.id}`} className="input" value={loc.text} maxLength={200} onChange={(e) => setLoc({ ...loc, text: e.target.value, source: "LANDMARK" })} aria-invalid={Boolean(error)} aria-describedby={error ? `e-${request.id}` : undefined} placeholder="e.g. Quay Road bus stop" />
                <button type="button" className="mt-2 text-sm underline underline-offset-2" onClick={() => setShowMap(true)}>
                  Or drop a pin on the map
                </button>
              </div>
            )}
          </>
        ) : (
          <div>
            <label htmlFor={`a-${request.id}`} className="label">
              Your answer
            </label>
            <textarea id={`a-${request.id}`} className="input h-auto py-3" rows={3} maxLength={1000} value={answer} onChange={(e) => setAnswer(e.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? `e-${request.id}` : undefined} />
          </div>
        )}
        {error && !showMap && (
          <p id={`e-${request.id}`} className="text-sm text-crit" role="alert">
            {error}
          </p>
        )}
        <button className="btn-primary" disabled={busy}>
          {busy ? "Sending…" : "Send answer"}
        </button>
      </form>
    </section>
  );
}

function LocationEditor({ token, initial, onCancel, onDone }: { token: string; initial: View; onCancel: () => void; onDone: () => void }) {
  const [loc, setLoc] = useState<PickedLocation>({
    ...EMPTY_LOCATION,
    lat: initial.location.lat,
    lng: initial.location.lng,
    text: initial.location.text ?? "",
    source: initial.location.lat != null ? "PIN" : "NONE",
    confirmed: false,
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const pinned = loc.lat != null && loc.lng != null;
    if (pinned && !loc.confirmed) return setError("Confirm the pin before saving.");
    if (!pinned && !loc.text.trim()) return setError("Drop a pin or type a landmark.");
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/track/${token}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: { ...(pinned ? { lat: loc.lat, lng: loc.lng, placeId: loc.placeId ?? undefined } : {}), text: loc.text.trim() || undefined, source: loc.source === "DEVICE" ? "DEVICE" : pinned ? "PIN" : "LANDMARK" } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't save the location.");
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section aria-labelledby="h-fixloc" className="card p-5 sm:p-6">
      <h2 id="h-fixloc" className="text-lg font-semibold tracking-tight">
        Correct the location
      </h2>
      <p className="mt-1 mb-4 hint">Your original report is kept; the city sees this as a correction.</p>
      <LocationPicker value={loc} onChange={setLoc} idPrefix="fix" error={error || undefined} />
      <div className="mt-4 flex gap-3">
        <button className="btn-primary" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save location"}
        </button>
        <button className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
}
