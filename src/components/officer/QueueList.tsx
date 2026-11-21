"use client";
import type { QueueRow } from "@/lib/officer";
import { subtypeLabel, type TicketStatusCode } from "@/lib/taxonomy";
import { timeAgo } from "@/lib/format";
import { SampleTag, SeverityBadge, StatusBadge } from "../Badges";

export function QueueList({
  state,
  rows,
  processing,
  failed,
  selectedId,
  onSelect,
  onHover,
  onRetry,
  filtered,
}: {
  state: "loading" | "ready" | "error";
  rows: QueueRow[];
  processing: number;
  failed: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onRetry: () => void;
  filtered: boolean;
}) {
  if (state === "loading")
    return (
      <div className="space-y-2 p-3" aria-busy="true" aria-label="Loading tickets">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[88px] animate-pulse rounded-xl bg-surface" />
        ))}
      </div>
    );
  if (state === "error")
    return (
      <div role="alert" className="m-4 rounded-xl border border-[#e7b7b5] bg-crit-soft p-4 text-sm text-crit">
        <p className="font-medium">Couldn&apos;t load the queue.</p>
        <button className="btn-outline btn-sm mt-3" onClick={onRetry}>
          Retry
        </button>
      </div>
    );

  const urgent = rows.filter((r) => r.urgentReview);
  const rest = rows.filter((r) => !r.urgentReview);
  const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 } as Record<string, number>;
  rows.forEach((r) => counts[r.severity]++);

  return (
    <div>
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-line bg-paper/95 px-4 py-2.5 text-xs text-muted backdrop-blur">
        <span>
          <strong className="text-ink">{rows.length}</strong> tickets · sorted by severity, then oldest
        </span>
        <span className="flex gap-2">
          {processing > 0 && <span className="chip border-line-strong bg-surface text-ink-2">⟳ {processing} processing</span>}
          {failed > 0 && <span className="chip border-[#e7b7b5] bg-crit-soft text-crit">{failed} AI failed</span>}
        </span>
      </div>
      <p className="sr-only" aria-live="polite">
        {counts.CRITICAL} critical, {counts.HIGH} high, {counts.MEDIUM} medium, {counts.LOW} low.
      </p>

      {rows.length === 0 && (
        <div className="p-8 text-center">
          <p className="font-medium">{filtered ? "No tickets match these filters." : "No open tickets. Nice."}</p>
          <p className="mt-1 text-sm text-muted">{filtered ? "Try clearing a filter." : "New reports appear here automatically."}</p>
        </div>
      )}

      {urgent.length > 0 && (
        <div className="border-b-2 border-crit bg-crit-soft/60">
          <h2 className="flex items-center gap-2 px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-crit">
            <span aria-hidden="true">▲</span> Urgent review · {urgent.length}
          </h2>
          <ul className="space-y-1.5 p-2 pt-1">
            {urgent.map((r) => (
              <Row key={r.id} r={r} selected={r.id === selectedId} onSelect={onSelect} onHover={onHover} />
            ))}
          </ul>
        </div>
      )}
      <ul className="space-y-1.5 p-2" aria-label="Tickets">
        {rest.map((r) => (
          <Row key={r.id} r={r} selected={r.id === selectedId} onSelect={onSelect} onHover={onHover} />
        ))}
      </ul>
    </div>
  );
}

function Row({ r, selected, onSelect, onHover }: { r: QueueRow; selected: boolean; onSelect: (id: string) => void; onHover: (id: string | null) => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(r.id)}
        onMouseEnter={() => onHover(r.id)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onHover(r.id)}
        onBlur={() => onHover(null)}
        aria-current={selected ? "true" : undefined}
        className={`group block w-full rounded-xl border px-3.5 py-3 text-left transition-colors ${selected ? "border-ink bg-surface shadow-[0_0_0_1px_var(--color-ink)]" : "border-line bg-surface hover:border-line-strong"} ${r.status === "RESOLVED" ? "opacity-70" : ""}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <SeverityBadge severity={r.severity} size="sm" />
            <span className="font-mono text-xs text-muted">{r.reference}</span>
            {r.isSample && <SampleTag />}
            {r.needsReevaluation && r.status !== "RESOLVED" && <span className="chip h-5 border-[#c9d6e5] bg-low-soft px-1.5 text-[10px] text-low">Updated</span>}
            {r.pendingSuggestions > 0 && <span className="chip h-5 border-line-strong px-1.5 text-[10px] text-ink-2" title="Possible duplicate needs a decision">Possible dup</span>}
          </div>
          <span className="shrink-0 text-xs text-muted" title={new Date(r.createdAt).toLocaleString()}>
            {timeAgo(r.createdAt)}
          </span>
        </div>
        <p className="mt-1.5 truncate text-[15px] font-medium leading-snug">{r.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-2">
          <span className="truncate">{subtypeLabel(r.subtype)}</span>
          {r.lat != null ? (
            <span className="truncate">⌖ {r.locationText ?? r.ward}{r.ward && r.locationText ? ` · ${r.ward.split(" · ")[0]}` : ""}</span>
          ) : (
            <span className="font-medium text-med">⌖ Location missing</span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <StatusBadge status={r.status as TicketStatusCode} />
          {r.department ? (
            <span className="chip border-line bg-paper text-ink-2">{r.department}</span>
          ) : (
            <span className="chip border-dashed border-crit bg-surface text-crit">Unassigned</span>
          )}
          {r.reportCount > 1 && (
            <span className="chip border-line bg-paper text-ink-2" title="Citizen reports linked to this ticket">
              {r.reportCount} reports
            </span>
          )}
        </div>
      </button>
    </li>
  );
}
