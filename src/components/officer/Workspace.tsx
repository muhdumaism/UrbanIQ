"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapPane } from "./MapPane";
import type { SessionOfficer } from "@/lib/auth";
import type { ModeInfo } from "@/lib/mode";
import type { QueueRow } from "@/lib/officer";
import { CATEGORIES, CATEGORY_LABEL, SEVERITIES, SEVERITY_LABEL, STATUS_LABEL, TICKET_STATUSES } from "@/lib/taxonomy";
import { OfficerTopBar } from "./OfficerTopBar";
import { QueueList } from "./QueueList";
import { TicketPanel } from "./TicketPanel";


type Filters = { view: string; status: string; ward: string; category: string; department: string; severity: string; q: string };
const DEFAULT_FILTERS: Filters = { view: "open", status: "", ward: "", category: "", department: "", severity: "", q: "" };

export function Workspace({ officer, departments, wards, mode }: { officer: SessionOfficer; departments: { id: string; name: string }[]; wards: { code: string; label: string }[]; mode: ModeInfo }) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [q, setQ] = useState("");
  const [data, setData] = useState<{ rows: QueueRow[]; processing: number; failed: number } | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [tab, setTab] = useState<"queue" | "map">("queue");
  const reqId = useRef(0);

  // Restore selection from URL (?t=) so a ticket can be linked/refreshed.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("t");
    if (t) setSelected(t);
  }, []);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (selected) url.searchParams.set("t", selected);
    else url.searchParams.delete("t");
    window.history.replaceState(null, "", url);
  }, [selected]);

  // Debounce search
  useEffect(() => {
    const id = setTimeout(() => setFilters((f) => ({ ...f, q })), 250);
    return () => clearTimeout(id);
  }, [q]);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]);
    try {
      const res = await fetch(`/api/officer/tickets?${params}`, { cache: "no-store" });
      if (res.status === 401) return window.location.assign("/officer/login?next=/officer");
      if (!res.ok) throw new Error();
      const json = await res.json();
      if (id === reqId.current) {
        setData(json);
        setState("ready");
      }
    } catch {
      if (id === reqId.current) setState((s) => (s === "ready" ? "ready" : "error"));
    }
  }, [filters]);

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const set = (k: keyof Filters, v: string) => setFilters((f) => ({ ...f, [k]: v }));
  const activeFilterCount = Object.entries(filters).filter(([k, v]) => v && !(k === "view" && v === "open") && k !== "q").length;

  return (
    <div className="flex h-dvh flex-col bg-paper">
      <OfficerTopBar officer={officer} mode={mode} />

      {/* Filters */}
      <div className="shrink-0 border-b border-line bg-surface px-4 py-2.5">
        <form role="search" onSubmit={(e) => e.preventDefault()} className="flex flex-wrap items-center gap-2">
          <label htmlFor="q" className="sr-only">
            Search tickets
          </label>
          <input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ref, place, text…" className="input h-9 w-full rounded-full text-sm sm:w-56" />
          <Select label="View" value={filters.view} onChange={(v) => set("view", v)} options={[["open", "Unresolved"], ["all", "All tickets"], ["resolved", "Resolved"]]} />
          <Select label="Severity" value={filters.severity} onChange={(v) => set("severity", v)} options={[["", "Any severity"], ...SEVERITIES.map((s) => [s, SEVERITY_LABEL[s]] as [string, string])]} />
          <Select label="Status" value={filters.status} onChange={(v) => set("status", v)} options={[["", "Any status"], ...TICKET_STATUSES.map((s) => [s, STATUS_LABEL[s]] as [string, string])]} />
          <Select label="Ward" value={filters.ward} onChange={(v) => set("ward", v)} options={[["", "Any ward"], ...wards.map((w) => [w.code, w.label] as [string, string]), ["none", "No ward / location"]]} />
          <Select label="Category" value={filters.category} onChange={(v) => set("category", v)} options={[["", "Any category"], ...CATEGORIES.map((c) => [c, CATEGORY_LABEL[c]] as [string, string])]} />
          <Select label="Department" value={filters.department} onChange={(v) => set("department", v)} options={[["", "Any department"], ["none", "Unassigned"], ...departments.map((d) => [d.id, d.name] as [string, string])]} />
          {(activeFilterCount > 0 || q) && (
            <button type="button" className="btn-ghost btn-sm" onClick={() => { setFilters(DEFAULT_FILTERS); setQ(""); }}>
              Clear filters
            </button>
          )}
        </form>
      </div>

      {/* Mobile tabs */}
      <div className="flex shrink-0 border-b border-line bg-surface lg:hidden" role="tablist" aria-label="Workspace view">
        {(["queue", "map"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`flex-1 py-2.5 text-sm font-medium capitalize ${tab === t ? "border-b-2 border-ink text-ink" : "text-muted"}`}>
            {t === "queue" ? `Queue${data ? ` (${rows.length})` : ""}` : "Map"}
          </button>
        ))}
      </div>

      <div className="relative grid min-h-0 flex-1 lg:grid-cols-[minmax(400px,480px)_1fr]">
        <section aria-label="Ticket queue" className={`min-h-0 overflow-y-auto border-r border-line bg-paper ${tab === "queue" ? "block" : "hidden"} lg:block`}>
          <QueueList
            state={state}
            rows={rows}
            processing={data?.processing ?? 0}
            failed={data?.failed ?? 0}
            selectedId={selected}
            onSelect={(id) => setSelected(id)}
            onHover={setHovered}
            onRetry={() => { setState("loading"); load(); }}
            filtered={activeFilterCount > 0 || Boolean(filters.q)}
          />
        </section>

        <section aria-label="Ward map" className={`relative isolate min-h-0 overflow-hidden bg-night ${tab === "map" ? "block" : "hidden"} lg:block`}>
          <MapPane rows={rows} selectedId={selected} hoveredId={hovered} onSelect={(id) => setSelected(id)} />
        </section>

        {selected && (
          <aside aria-label="Ticket details" className="absolute inset-0 z-30 overflow-y-auto bg-surface shadow-[-8px_0_24px_rgba(0,0,0,.18)] lg:left-auto lg:w-[min(560px,55vw)] lg:border-l lg:border-line">
            <TicketPanel id={selected} onClose={() => setSelected(null)} onChanged={load} officer={officer} />
          </aside>
        )}
      </div>
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  const id = `f-${label.toLowerCase()}`;
  return (
    <>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={`h-9 rounded-full border bg-surface px-3 text-sm ${value && !(label === "View" && value === "open") ? "border-ink font-medium" : "border-line-strong text-ink-2"}`}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </>
  );
}
