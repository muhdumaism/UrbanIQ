"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { TicketDetail } from "@/lib/officer";
import type { SessionOfficer } from "@/lib/auth";
import { CATEGORY_LABEL, SEVERITIES, SEVERITY_LABEL, subtypeLabel, type CategoryCode, type SeverityCode, type TicketStatusCode } from "@/lib/taxonomy";
import { formatDateTime, timeAgoLong } from "@/lib/format";
import { SampleTag, SeverityBadge, StatusBadge } from "../Badges";
import { MiniMap } from "../map/MiniMap";
import { PhotoWithDetections, VisionSummary } from "./VisionEvidence";
import { GooglePlaceName } from "../map/GooglePlaceName";

type Detail = TicketDetail & { canAct: boolean };
type FormKind = "assign" | "severity" | "request" | "resolve" | "note" | "public" | "reopen" | null;

export function TicketPanel({ id, onClose, onChanged, officer, standalone = false }: { id: string; onClose?: () => void; onChanged?: () => void; officer: SessionOfficer; standalone?: boolean }) {
  const [t, setT] = useState<Detail | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error" | "notfound">("loading");
  const [form, setForm] = useState<FormKind>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/officer/tickets/${id}`, { cache: "no-store" });
      if (res.status === 401) return window.location.assign("/officer/login");
      if (res.status === 404) return setState("notfound");
      if (!res.ok) throw new Error();
      setT(await res.json());
      setState("ready");
    } catch {
      setState("error");
    }
  }, [id]);

  useEffect(() => {
    setState("loading");
    setForm(null);
    setError("");
    load();
  }, [load]);
  useEffect(() => {
    if (state === "ready") headingRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state === "ready", id]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  // Poll while a report is still processing
  useEffect(() => {
    if (!t?.reports.some((r) => r.status === "RECEIVED" || r.status === "PROCESSING")) return;
    const x = setInterval(load, 2500);
    return () => clearInterval(x);
  }, [t, load]);

  const act = async (body: Record<string, unknown>, done: string) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/officer/tickets/${id}/actions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) return window.location.assign("/officer/login");
      if (!res.ok) throw new Error(data.error ?? "Action failed.");
      setForm(null);
      await load();
      setFlash(done);
      setTimeout(() => setFlash(""), 3000);
      onChanged?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (state === "loading")
    return (
      <div className="space-y-4 p-6" aria-busy="true">
        <div className="h-6 w-40 animate-pulse rounded bg-paper" />
        <div className="h-8 w-3/4 animate-pulse rounded bg-paper" />
        <div className="h-40 animate-pulse rounded-xl bg-paper" />
      </div>
    );
  if (state === "notfound" || state === "error" || !t)
    return (
      <div className="p-6">
        {onClose && <CloseButton onClose={onClose} />}
        <p role="alert" className="mt-4 font-medium">
          {state === "notfound" ? "Ticket not found." : "Couldn't load this ticket."}
        </p>
        {state === "error" && (
          <button className="btn-outline btn-sm mt-3" onClick={() => { setState("loading"); load(); }}>
            Retry
          </button>
        )}
      </div>
    );

  const status = t.status as TicketStatusCode;
  const resolved = status === "RESOLVED";
  const primary: { label: string; run: () => void } | null = !t.canAct || t.mergedInto
    ? null
    : resolved
      ? { label: "Reopen ticket", run: () => setForm("reopen") }
      : !t.departmentId
        ? { label: "Assign department", run: () => setForm("assign") }
        : status === "IN_PROGRESS"
          ? { label: "Resolve", run: () => setForm("resolve") }
          : status === "ACKNOWLEDGED"
            ? { label: "Start work (In progress)", run: () => act({ action: "start" }, "Moved to In progress") }
            : { label: "Acknowledge", run: () => act({ action: "acknowledge" }, "Acknowledged") };

  return (
    <article className="pb-16" aria-labelledby="ticket-title">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-line bg-surface/95 px-5 pt-4 pb-4 backdrop-blur sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-muted">{t.reference}</span>
            {t.isSample && <SampleTag />}
            <SeverityBadge severity={t.severity} />
            <StatusBadge status={status} />
            {t.department ? <span className="chip border-line bg-paper text-ink-2">{t.department}</span> : <span className="chip border-dashed border-crit text-crit">Unassigned</span>}
          </div>
          <div className="flex items-center gap-1">
            {!standalone && (
              <Link href={`/officer/tickets/${t.id}`} className="btn-ghost btn-sm hidden sm:inline-flex">
                Open page
              </Link>
            )}
            {onClose && <CloseButton onClose={onClose} />}
          </div>
        </div>
        <h2 id="ticket-title" ref={headingRef} tabIndex={-1} className="mt-2 text-xl font-semibold leading-tight tracking-tight outline-none">
          {t.title}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {CATEGORY_LABEL[t.category as CategoryCode]} · {subtypeLabel(t.subtype)} · opened {timeAgoLong(t.createdAt)} · {t.reports.length} report{t.reports.length === 1 ? "" : "s"}
        </p>

        {/* Next action */}
        {primary && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button className="btn-primary" disabled={busy} onClick={primary.run}>
              {busy ? "Saving…" : primary.label}
            </button>
            {!resolved && (
              <>
                {t.departmentId && (
                  <button className="btn-outline btn-sm" onClick={() => setForm("assign")}>
                    Reroute
                  </button>
                )}
                <button className="btn-outline btn-sm" onClick={() => setForm("severity")}>
                  Correct severity
                </button>
                <button className="btn-outline btn-sm" onClick={() => setForm("request")}>
                  Request detail
                </button>
                {status !== "IN_PROGRESS" && (
                  <button className="btn-outline btn-sm" onClick={() => setForm("resolve")}>
                    Resolve
                  </button>
                )}
                <MoreMenu
                  items={[
                    { label: "Post citizen update", run: () => setForm("public") },
                    { label: "Add internal note", run: () => setForm("note") },
                    ...(t.needsReevaluation || t.reviewReasons.length || t.urgentReview ? [{ label: "Mark reviewed", run: () => act({ action: "mark_reviewed" }, "Marked reviewed") }] : []),
                  ]}
                />
              </>
            )}
          </div>
        )}
        {!t.canAct && <p className="mt-3 rounded-lg bg-paper px-3 py-2 text-sm text-ink-2">Read-only: this ticket belongs to {t.department}. A supervisor can reroute it.</p>}
        {t.mergedInto && (
          <p className="mt-3 rounded-lg bg-paper px-3 py-2 text-sm">
            Merged into{" "}
            <Link className="font-medium underline" href={`/officer?t=${t.mergedInto.id}`}>
              {t.mergedInto.reference}
            </Link>
            .
          </p>
        )}
        <div aria-live="polite" className="text-sm">
          {flash && <p className="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-accent-ink">✓ {flash}</p>}
        </div>
        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-crit-soft px-3 py-2 text-sm text-crit">
            {error}
          </p>
        )}
        {form && <ActionForm kind={form} t={t} busy={busy} onCancel={() => { setForm(null); setError(""); }} onSubmit={act} officer={officer} />}
      </div>

      <div className="space-y-6 px-5 pt-5 sm:px-6">
        {/* Review flags */}
        {(t.urgentReview || t.reviewReasons.length > 0 || t.needsReevaluation) && !resolved && (
          <section aria-label="Review flags" className={`rounded-xl border p-4 ${t.urgentReview ? "border-crit bg-crit-soft" : "border-[#ecd894] bg-med-soft"}`}>
            {t.urgentReview && <p className="font-semibold text-crit">▲ Urgent review — possible critical hazard with missing ward or owner</p>}
            {t.needsReevaluation && <p className="font-medium text-low">Citizen or system update since last review — re-evaluate.</p>}
            {t.reviewReasons.length > 0 && (
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-ink-2">
                {t.reviewReasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Duplicate suggestions */}
        {t.suggestions.length > 0 && !t.mergedInto && (
          <section aria-labelledby="h-dup" className="rounded-xl border border-ink p-4">
            <h3 id="h-dup" className="font-semibold">
              Possible {t.suggestions.some((s) => s.kind === "POSSIBLE_RECURRENCE") ? "duplicate or recurrence" : "duplicate"}
            </h3>
            <ul className="mt-2 space-y-3">
              {t.suggestions.map((s) => (
                <li key={s.id} className="rounded-lg bg-paper p-3 text-sm">
                  <p>
                    <span className="font-medium">{s.kind === "POSSIBLE_RECURRENCE" ? "Recurrence?" : s.direction === "this_may_duplicate" ? "This may duplicate" : "May duplicate this ticket:"}</span>{" "}
                    <Link href={`/officer?t=${s.other.id}`} className="font-mono underline">
                      {s.other.reference}
                    </Link>{" "}
                    — {s.other.title} <span className="text-muted">({s.other.status})</span>
                  </p>
                  <p className="mt-1 text-ink-2">{s.explanation}</p>
                  {t.canAct && (
                    <div className="mt-2 flex gap-2">
                      <button className="btn-dark btn-sm" disabled={busy} onClick={() => act({ action: "confirm_suggestion", suggestionId: s.id }, s.kind === "POSSIBLE_RECURRENCE" ? "Recurrence confirmed" : "Duplicate confirmed and merged")}>
                        {s.kind === "POSSIBLE_RECURRENCE" ? "Confirm recurrence" : "Confirm & merge"}
                      </button>
                      <button className="btn-outline btn-sm" disabled={busy} onClick={() => act({ action: "dismiss_suggestion", suggestionId: s.id }, "Suggestion dismissed")}>
                        Not the same
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Severity + summary */}
        <section aria-labelledby="h-why" className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-line p-4">
            <h3 id="h-why" className="text-sm text-muted">
              Why {SEVERITY_LABEL[t.severity]}
            </h3>
            <p className="mt-1 font-medium leading-snug">{t.severityReason}</p>
          </div>
          <div className="rounded-xl border border-line p-4">
            <h3 className="text-sm text-muted">AI summary</h3>
            <p className="mt-1 text-[15px] leading-snug text-ink-2">{t.summary}</p>
          </div>
        </section>

        {/* Location */}
        <section aria-labelledby="h-location" className="overflow-hidden rounded-xl border border-line">
          <div className="flex flex-wrap items-start justify-between gap-2 p-4">
            <div>
              <h3 id="h-location" className="text-sm text-muted">
                Location
              </h3>
              {t.lat != null ? (
                <>
                  <p className="mt-1 font-medium">{t.locationText ?? t.landmark ?? "Pinned location"}</p>
                  <p className="text-sm text-ink-2">
                    {t.ward ?? "Outside sample wards"} · {t.locationPrecise ? "Citizen-confirmed pin" : `Approximate (from landmark${t.landmark ? `: ${t.landmark}` : ""})`}
                  </p>
                </>
              ) : (
                <p className="mt-1 font-medium text-med">Location missing{t.locationText ? ` — citizen wrote “${t.locationText}”` : ""}</p>
              )}
            </div>
            <div className="text-right">
              <h3 className="text-sm text-muted">Responsible department</h3>
              <p className="mt-1 font-medium">{t.department ?? <span className="text-crit">Not assigned</span>}</p>
            </div>
          </div>
          {t.lat != null && t.lng != null && <MiniMap lat={t.lat} lng={t.lng} label={`Ticket location in ${t.ward ?? "Port Alder"}`} />}
        </section>

        {/* Info requests */}
        {t.infoRequests.length > 0 && (
          <section aria-labelledby="h-req">
            <h3 id="h-req" className="font-semibold">
              Questions to citizens
            </h3>
            <ul className="mt-2 space-y-2">
              {t.infoRequests.map((r) => (
                <li key={r.id} className="rounded-lg border border-line p-3 text-sm">
                  <p>
                    <span className="font-mono text-xs text-muted">{r.report}</span> · {r.question}
                  </p>
                  {r.status === "ANSWERED" ? (
                    <p className="mt-1 text-accent-ink">↳ Answered: “{r.answer}” <span className="text-muted">({r.answeredAt && formatDateTime(r.answeredAt)})</span></p>
                  ) : (
                    <p className="mt-1 text-muted">{r.status === "OPEN" ? "Waiting for citizen…" : "Cancelled"}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Reports */}
        <section aria-labelledby="h-reports">
          <h3 id="h-reports" className="font-semibold">
            Citizen reports ({t.reports.length})
          </h3>
          <div className="mt-2 space-y-4">
            {t.reports.map((r) => (
              <ReportCard key={r.id} r={r} canAct={t.canAct} busy={busy} onRetry={() => act({ action: "retry_processing", reportId: r.id }, `AI processing re-queued for ${r.reference}`)} />
            ))}
          </div>
        </section>

        {/* Activity */}
        <section aria-labelledby="h-activity">
          <h3 id="h-activity" className="font-semibold">
            Activity history
          </h3>
          <ol className="mt-3 space-y-3 border-l border-line pl-4">
            {t.events.map((e) => (
              <li key={e.id} className="relative text-sm">
                <span className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-surface ${e.actorType === "OFFICER" ? "bg-ink" : e.actorType === "CITIZEN" ? "bg-accent-hover" : "bg-line-strong"}`} aria-hidden="true" />
                <p className="flex flex-wrap items-center gap-x-2">
                  <span className="font-medium">{e.actor}</span>
                  <span className="text-ink-2">{eventLabel(e.type)}</span>
                  {e.report && <span className="font-mono text-xs text-muted">{e.report}</span>}
                  <span className={`chip h-5 px-1.5 text-[10px] ${e.visibility === "PUBLIC" ? "border-[#b9d36a] text-accent-ink" : "border-line text-muted"}`}>{e.visibility === "PUBLIC" ? "Citizen-visible" : "Internal"}</span>
                </p>
                {e.note && <p className="mt-0.5 text-ink-2">{e.note}</p>}
                {e.publicMessage && e.visibility === "PUBLIC" && <p className="mt-0.5 text-muted">Citizen sees: “{e.publicMessage}”</p>}
                {(e.before || e.after) && <BeforeAfter before={e.before} after={e.after} />}
                <p className="text-xs text-muted">{formatDateTime(e.at)}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </article>
  );
}

function ReportCard({ r, canAct, busy, onRetry }: { r: TicketDetail["reports"][number]; canAct: boolean; busy: boolean; onRetry: () => void }) {
  const tri = r.triage;
  const processing = r.status === "RECEIVED" || r.status === "PROCESSING";
  return (
    <div className="rounded-xl border border-line">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5 text-sm">
        <span>
          <span className="font-mono">{r.reference}</span>
          <span className="text-muted"> · {formatDateTime(r.submittedAt)}</span>
          {r.linkType === "AUTO_LINKED" && <span className="ml-2 chip h-5 border-line px-1.5 text-[10px] text-ink-2">Auto-linked</span>}
          {r.linkType === "OFFICER_LINKED" && <span className="ml-2 chip h-5 border-line px-1.5 text-[10px] text-ink-2">Merged by officer</span>}
        </span>
        <span className="text-xs text-muted">{processing ? "⟳ Processing…" : r.triageProvider ? `Triage: ${r.triageProvider}` : ""}</span>
      </div>
      <div className="space-y-3 p-4">
        {r.status === "FAILED" && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-crit-soft px-3 py-2 text-sm text-crit">
            <span>AI processing failed: {r.triageError ?? "unknown error"}. Showing keyword fallback.</span>
            {canAct && (
              <button className="btn-outline btn-sm" disabled={busy} onClick={onRetry}>
                Retry AI processing
              </button>
            )}
          </div>
        )}
        {processing && r.triageError && <p className="text-sm text-med">{r.triageError}</p>}
        <div>
          <h4 className="text-xs font-medium uppercase tracking-wider text-muted">Original complaint</h4>
          {r.text ? <blockquote className="mt-1 border-l-2 border-line-strong pl-3 text-[15px]">{r.text}</blockquote> : <p className="mt-1 text-muted">No text — photo only.</p>}
          <p className="mt-1 text-xs text-muted">
            Location given: {r.location.lat != null ? `${r.location.confirmed ? "confirmed" : "unconfirmed"} ${r.location.source === "DEVICE" ? "device location" : "pin"}` : "no pin"}
            {r.location.text ? ` · citizen wrote “${r.location.text}”` : ""}
          </p>
          {r.location.placeId && <GooglePlaceName placeId={r.location.placeId} />}
        </div>
        {r.photoUrl && <PhotoWithDetections src={r.photoUrl} alt={`Photo submitted with ${r.reference}`} vision={r.vision} />}
        <VisionSummary vision={r.vision} />
        {tri && (
          <div className="grid gap-3 sm:grid-cols-2">
            <EvidenceList title="What the citizen reported" items={tri.citizen_facts} empty="No text provided." />
            <EvidenceList title="What the image shows" items={tri.photo_observations} empty={r.hasPhoto ? "No observations." : "No photo."} />
            {tri.risk_factors.length > 0 && (
              <div className="sm:col-span-2">
                <h4 className="text-xs font-medium uppercase tracking-wider text-muted">Risk factors</h4>
                <ul className="mt-1 space-y-1 text-sm">
                  {tri.risk_factors.map((f, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="chip h-5 shrink-0 border-line px-1.5 text-[10px] text-ink-2">{f.source === "photo" ? "Photo" : f.source === "both" ? "Text + photo" : "Citizen"}</span>
                      <span>
                        <span className="font-medium">{f.factor.replace(/_/g, " ")}</span> — {f.detail}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(tri.missing_information.length > 0 || tri.conflicts.length > 0) && (
              <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2">
                <EvidenceList title="Missing information" items={tri.missing_information} empty="—" />
                <EvidenceList title="Conflicting evidence" items={tri.conflicts} empty="None found." />
              </div>
            )}
            {(tri.location_clues.length > 0 || tri.asset_identifiers.length > 0) && (
              <p className="text-xs text-muted sm:col-span-2">
                Location clues: {tri.location_clues.join(", ") || "—"}
                {tri.asset_identifiers.length > 0 && ` · Asset IDs: ${tri.asset_identifiers.join(", ")}`}
              </p>
            )}
            <p className="text-xs text-muted sm:col-span-2">
              Report assessed as {r.severity ? SEVERITY_LABEL[r.severity as SeverityCode] : "—"}: {r.severityReason}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function EvidenceList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div>
      <h4 className="text-xs font-medium uppercase tracking-wider text-muted">{title}</h4>
      {items.length ? (
        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm">
          {items.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-muted">{empty}</p>
      )}
    </div>
  );
}

function BeforeAfter({ before, after }: { before: unknown; after: unknown }) {
  const fmt = (v: unknown) => {
    if (!v || typeof v !== "object") return "—";
    return Object.entries(v as Record<string, unknown>)
      .filter(([k]) => !k.endsWith("Id"))
      .map(([k, x]) => `${k}: ${x === null ? "none" : typeof x === "object" ? JSON.stringify(x) : String(x)}`)
      .join(", ");
  };
  return (
    <p className="mt-0.5 font-mono text-[11px] text-muted">
      {before ? <span className="line-through decoration-line-strong">{fmt(before)}</span> : null}
      {before && after ? " → " : ""}
      {after ? <span className="text-ink-2">{fmt(after)}</span> : null}
    </p>
  );
}

const EVENT_LABELS: Record<string, string> = {
  report_received: "received a report",
  triaged: "triaged the report",
  triage_failed: "could not triage (AI failure)",
  triage_rerun: "re-ran triage",
  routed: "routed the ticket",
  routing_uncertain: "could not determine the owner",
  urgent_review: "flagged for urgent review",
  info_requested: "requested a detail",
  duplicate_suggested: "suggested a possible duplicate",
  recurrence_suggested: "suggested a possible recurrence",
  report_linked: "linked a report",
  severity_raised: "raised severity",
  status_changed: "changed status",
  assigned: "assigned the department",
  rerouted: "rerouted",
  severity_corrected: "corrected severity",
  suggestion_dismissed: "dismissed a suggestion",
  duplicate_confirmed: "confirmed a duplicate",
  recurrence_confirmed: "confirmed a recurrence",
  merged: "merged this ticket",
  note: "added a note",
  public_update: "posted a citizen update",
  reviewed: "marked reviewed",
  retry_requested: "retried AI processing",
  location_corrected: "corrected the location",
  detail_provided: "provided a detail",
  reevaluation_needed: "flagged for re-evaluation",
};
const eventLabel = (t: string) => EVENT_LABELS[t] ?? t.replace(/_/g, " ");

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button onClick={onClose} className="btn-ghost btn-sm" aria-label="Close ticket details">
      ✕<span className="hidden sm:inline">Close</span>
    </button>
  );
}

function MoreMenu({ items }: { items: { label: string; run: () => void }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button className="btn-ghost btn-sm" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((o) => !o)}>
        More ▾
      </button>
      {open && (
        <ul className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-line bg-surface p-1 shadow-lg">
          {items.map((i) => (
            <li key={i.label}>
              <button className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-paper" onClick={() => { setOpen(false); i.run(); }}>
                {i.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ActionForm({ kind, t, busy, onCancel, onSubmit, officer }: { kind: Exclude<FormKind, null>; t: Detail; busy: boolean; onCancel: () => void; onSubmit: (b: Record<string, unknown>, done: string) => void; officer: SessionOfficer }) {
  const [dept, setDept] = useState(t.departmentId ?? "");
  const [sev, setSev] = useState<SeverityCode>(t.severity);
  const [text, setText] = useState("");
  const [reqKind, setReqKind] = useState<"LOCATION" | "DETAIL">(t.lat == null ? "LOCATION" : "DETAIL");
  const [localErr, setLocalErr] = useState("");
  const firstRef = useRef<HTMLSelectElement & HTMLTextAreaElement>(null);
  useEffect(() => firstRef.current?.focus(), []);

  const titles: Record<string, string> = {
    assign: t.departmentId ? "Reroute to another department" : "Assign department",
    severity: "Correct severity",
    request: "Request a detail from the citizen",
    resolve: "Resolve ticket",
    note: "Internal note",
    public: "Citizen-visible update",
    reopen: "Reopen ticket",
  };
  const needReason = kind === "severity" || kind === "reopen" || (kind === "assign" && Boolean(t.departmentId));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalErr("");
    const txt = text.trim();
    if ((needReason || kind === "resolve" || kind === "note" || kind === "public" || kind === "request") && txt.length < 3) {
      return setLocalErr(kind === "resolve" ? "Add a short resolution note for the citizen." : kind === "request" ? "Write the question for the citizen." : "A reason is required.");
    }
    switch (kind) {
      case "assign":
        if (!dept || dept === t.departmentId) return setLocalErr("Choose a different department.");
        return onSubmit({ action: "assign_department", departmentId: dept, reason: txt || undefined }, t.departmentId ? "Rerouted" : "Department assigned");
      case "severity":
        if (sev === t.severity) return setLocalErr("Choose a different severity.");
        return onSubmit({ action: "correct_severity", severity: sev, reason: txt }, "Severity corrected");
      case "request":
        return onSubmit({ action: "request_detail", kind: reqKind, question: txt }, "Question sent to citizen");
      case "resolve":
        return onSubmit({ action: "resolve", note: txt }, "Resolved");
      case "note":
        return onSubmit({ action: "add_note", note: txt }, "Note added");
      case "public":
        return onSubmit({ action: "public_update", message: txt }, "Update posted");
      case "reopen":
        return onSubmit({ action: "reopen", reason: txt }, "Reopened");
    }
  };

  const textLabel =
    kind === "resolve" ? "Resolution note (shown to citizens)" : kind === "request" ? "Question for the citizen" : kind === "note" ? "Note (internal only)" : kind === "public" ? "Message (shown to citizens)" : needReason ? "Reason (required, internal)" : "Reason (optional)";

  return (
    <form onSubmit={submit} noValidate className="mt-4 space-y-3 rounded-xl border border-ink bg-paper p-4" aria-labelledby="action-title">
      <h3 id="action-title" className="font-semibold">
        {titles[kind]}
      </h3>
      {kind === "assign" && (
        <div>
          <label htmlFor="dept" className="label">
            Department
          </label>
          <select id="dept" ref={firstRef} value={dept} onChange={(e) => setDept(e.target.value)} className="input">
            <option value="">Choose…</option>
            {t.departments.map((d) => (
              <option key={d.id} value={d.id} disabled={d.id === t.departmentId}>
                {d.name}
                {d.id === t.departmentId ? " (current)" : ""}
              </option>
            ))}
          </select>
          {officer.role !== "SUPERVISOR" && <p className="mt-1 hint">After rerouting away from your department, only a supervisor or the new department can act on it.</p>}
        </div>
      )}
      {kind === "severity" && (
        <fieldset>
          <legend className="label">Severity</legend>
          <div className="flex flex-wrap gap-2">
            {SEVERITIES.map((s) => (
              <label key={s} className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${sev === s ? "border-ink bg-surface" : "border-line-strong"}`}>
                <input type="radio" name="sev" value={s} checked={sev === s} onChange={() => setSev(s)} className="accent-ink" />
                {SEVERITY_LABEL[s]}
                {s === t.severity && <span className="text-xs text-muted">(current)</span>}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {kind === "request" && (
        <fieldset>
          <legend className="label">What&apos;s missing?</legend>
          <div className="flex gap-2">
            {(["LOCATION", "DETAIL"] as const).map((k) => (
              <label key={k} className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${reqKind === k ? "border-ink bg-surface" : "border-line-strong"}`}>
                <input type="radio" name="reqkind" checked={reqKind === k} onChange={() => setReqKind(k)} className="accent-ink" />
                {k === "LOCATION" ? "Location" : "Other detail"}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div>
        <label htmlFor="action-text" className="label">
          {textLabel}
        </label>
        <textarea
          id="action-text"
          ref={kind === "assign" || kind === "severity" ? undefined : firstRef}
          rows={kind === "note" ? 3 : 2}
          maxLength={500}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="input h-auto py-2.5"
          aria-invalid={Boolean(localErr)}
          aria-describedby={localErr ? "action-err" : undefined}
          placeholder={kind === "request" ? (reqKind === "LOCATION" ? "Which school or nearby landmark is this next to?" : "Is the wire still sparking?") : kind === "resolve" ? "e.g. Pothole filled and lane reopened." : ""}
        />
        {localErr && (
          <p id="action-err" className="mt-1.5 text-sm text-crit">
            {localErr}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <button className="btn-dark btn-sm" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" className="btn-ghost btn-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

