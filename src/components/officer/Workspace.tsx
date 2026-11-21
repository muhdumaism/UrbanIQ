"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapPane } from "./MapPane";
import { distanceKm, useOfficerLocation } from "./useOfficerLocation";
import type { SessionOfficer } from "@/lib/auth";
import type { ModeInfo } from "@/lib/mode";
import type { QueueRow } from "@/lib/officer";
import { CATEGORIES, CATEGORY_LABEL, SEVERITIES, SEVERITY_LABEL, STATUS_LABEL, TICKET_STATUSES } from "@/lib/taxonomy";
import { LogoMark } from "../Logo";
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

  const { loc, locate } = useOfficerLocation();
  const [nearKm, setNearKm] = useState("");
  const allRows = useMemo(() => data?.rows ?? [], [data]);
  const distances = useMemo(() => {
    const m = new Map<string, number>();
    if (loc.status === "ok") for (const r of allRows) if (r.lat != null && r.lng != null) m.set(r.id, distanceKm(loc.pos, { lat: r.lat, lng: r.lng }));
    return m;
  }, [allRows, loc]);
  const rows = useMemo(
    () => (nearKm && loc.status === "ok" ? allRows.filter((r) => (distances.get(r.id) ?? Infinity) <= Number(nearKm)) : allRows),
    [allRows, nearKm, loc.status, distances],
  );
  const set = (k: keyof Filters, v: string) => setFilters((f) => ({ ...f, [k]: v }));
  const activeFilterCount = Object.entries(filters).filter(([k, v]) => v && !(k === "view" && v === "open") && k !== "q").length;
  const [showFilters, setShowFilters] = useState(false);
  const [heatmap, setHeatmap] = useState(true);
  const index = selected ? rows.findIndex((r) => r.id === selected) : -1;
  const mapCmd = (cmd: string) => window.dispatchEvent(new CustomEvent("urbaniq:map", { detail: cmd }));
  const clearAll = () => {
    setFilters(DEFAULT_FILTERS);
    setQ("");
    setNearKm("");
  };

  return (
    <div className="relative h-dvh overflow-hidden bg-night text-[14px]">
      {/* Map: full-bleed background */}
      <section aria-label="Ward map" className={`absolute inset-0 isolate ${tab === "map" ? "block" : "hidden"} lg:block`}>
        <MapPane rows={rows} selectedId={selected} hoveredId={hovered} onSelect={(id) => setSelected(id)} officerPos={loc.status === "ok" ? loc.pos : null} heatmap={heatmap} />
      </section>

      {/* Top-left: search + filters */}
      <div className="absolute left-3 right-3 top-3 z-20 flex items-start gap-2 lg:right-auto lg:w-[360px]">
        <form role="search" onSubmit={(e) => e.preventDefault()} className="flex h-10 flex-1 items-center gap-2 rounded-xl bg-white px-3 shadow-lg">
          <LogoMark className="h-5 w-5 shrink-0" />
          <label htmlFor="q" className="sr-only">
            Search tickets
          </label>
          <input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tickets, places…" className="h-full min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-[#8b8f95]" />
          <button type="button" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} aria-controls="filters" className={`rounded-lg px-2 py-1 text-[13px] ${showFilters || activeFilterCount ? "bg-ink text-white" : "text-ink-2 hover:bg-paper"}`}>
            Filters{activeFilterCount ? ` · ${activeFilterCount}` : ""}
          </button>
        </form>
      </div>

      {showFilters && (
        <div id="filters" className="absolute left-3 top-16 z-30 w-[calc(100%-24px)] rounded-xl bg-white p-3 shadow-xl lg:w-[360px]">
          <div className="grid grid-cols-2 gap-2">
            <Select label="View" value={filters.view} onChange={(v) => set("view", v)} options={[["open", "Unresolved"], ["all", "All tickets"], ["resolved", "Resolved"]]} />
            <Select label="Severity" value={filters.severity} onChange={(v) => set("severity", v)} options={[["", "Any severity"], ...SEVERITIES.map((s) => [s, SEVERITY_LABEL[s]] as [string, string])]} />
            <Select label="Status" value={filters.status} onChange={(v) => set("status", v)} options={[["", "Any status"], ...TICKET_STATUSES.map((s) => [s, STATUS_LABEL[s]] as [string, string])]} />
            <Select label="Category" value={filters.category} onChange={(v) => set("category", v)} options={[["", "Any category"], ...CATEGORIES.map((c) => [c, CATEGORY_LABEL[c]] as [string, string])]} />
            <Select label="Department" value={filters.department} onChange={(v) => set("department", v)} options={[["", "Any department"], ["none", "Unassigned"], ...departments.map((d) => [d.id, d.name] as [string, string])]} />
            {wards.length > 0 && <Select label="Ward" value={filters.ward} onChange={(v) => set("ward", v)} options={[["", "Any ward"], ...wards.map((w) => [w.code, w.label] as [string, string]), ["none", "No ward"]]} />}
          </div>
          <div className="mt-3 flex justify-between">
            <button type="button" className="text-[13px] text-ink-2 underline underline-offset-2" onClick={clearAll}>
              Clear all
            </button>
            <button type="button" className="rounded-lg bg-ink px-3 py-1.5 text-[13px] text-white" onClick={() => setShowFilters(false)}>
              Done
            </button>
          </div>
        </div>
      )}

      {/* Top-right: map tools + account */}
      <div className="absolute right-3 top-3 z-20 hidden items-center gap-2 lg:flex">
        <div className="flex h-10 items-center gap-1 rounded-xl bg-white px-1.5 shadow-lg">
          <button type="button" aria-pressed={heatmap} onClick={() => setHeatmap((h) => !h)} className={`rounded-lg px-2.5 py-1.5 text-[13px] ${heatmap ? "bg-ink text-white" : "text-ink-2 hover:bg-paper"}`}>
            Heatmap {heatmap ? "on" : "off"}
          </button>
          <button type="button" onClick={() => (loc.status === "ok" ? mapCmd("locate") : locate())} className="rounded-lg px-2.5 py-1.5 text-[13px] text-ink-2 hover:bg-paper">
            My area
          </button>
        </div>
        <div className="flex h-10 items-center gap-3 rounded-xl bg-white pl-3 pr-1.5 shadow-lg">
          {mode.demo ? <span className="text-[12px] text-muted">Demo</span> : !mode.liveAi ? <span className="text-[12px] text-high">AI key missing</span> : null}
          <span className="text-[13px]">{officer.name}</span>
          <button type="button" onClick={signOut} className="rounded-lg px-2.5 py-1.5 text-[13px] text-ink-2 hover:bg-paper">
            Sign out
          </button>
        </div>
      </div>

      {/* Mobile tabs */}
      <div className="absolute inset-x-3 top-16 z-10 flex rounded-xl bg-white p-1 shadow-lg lg:hidden" role="tablist" aria-label="Workspace view">
        {(["queue", "map"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`flex-1 rounded-lg py-1.5 text-[13px] capitalize ${tab === t ? "bg-ink text-white" : "text-ink-2"}`}>
            {t === "queue" ? `Queue${data ? ` (${rows.length})` : ""}` : "Map"}
          </button>
        ))}
      </div>

      {/* Left: ticket queue */}
      <section
        aria-label="Ticket queue"
        className={`absolute inset-x-3 bottom-3 top-[116px] z-10 flex-col overflow-hidden rounded-xl bg-white shadow-xl lg:bottom-[92px] lg:right-auto lg:top-16 lg:flex lg:w-[360px] ${tab === "queue" ? "flex" : "hidden"}`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
          <span className="text-[13px] text-muted">
            <strong className="font-semibold text-ink">{rows.length}</strong> {filters.view === "resolved" ? "resolved" : filters.view === "all" ? "tickets" : "open"}
          </span>
          <label htmlFor="f-near" className="sr-only">
            Distance from me
          </label>
          <select id="f-near" value={nearKm} disabled={loc.status !== "ok"} onChange={(e) => setNearKm(e.target.value)} className="rounded-md bg-paper px-2 py-1 text-[12px] disabled:opacity-50" title={loc.status === "ok" ? "Filter by distance from you" : "Allow location to filter by distance"}>
            <option value="">Any distance</option>
            <option value="2">Within 2 km of me</option>
            <option value="5">Within 5 km of me</option>
            <option value="10">Within 10 km of me</option>
            <option value="25">Within 25 km of me</option>
          </select>
        </div>
        <p role="status" className="px-3 pt-1.5 text-[12px] text-muted empty:hidden">
          {loc.status === "ok" ? (
            "Your location detected"
          ) : loc.status === "locating" ? (
            "Detecting your location…"
          ) : loc.status === "denied" ? (
            <>
              Location permission denied — showing all tickets.{" "}
              <button type="button" className="underline" onClick={locate}>
                Retry
              </button>
            </>
          ) : loc.status === "unavailable" ? (
            <>
              Location unavailable.{" "}
              <button type="button" className="underline" onClick={locate}>
                Retry
              </button>
            </>
          ) : null}
        </p>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <QueueList
            state={state}
            rows={rows}
            processing={data?.processing ?? 0}
            failed={data?.failed ?? 0}
            selectedId={selected}
            onSelect={(id) => setSelected(id)}
            onHover={setHovered}
            onRetry={() => {
              setState("loading");
              load();
            }}
            filtered={activeFilterCount > 0 || Boolean(filters.q) || Boolean(nearKm)}
            distances={distances}
            onClear={clearAll}
          />
        </div>
      </section>

      {/* Map zoom / locate controls (stay clear of the detail panel) */}
      <div className={`absolute bottom-[100px] z-10 hidden flex-col overflow-hidden rounded-xl bg-white shadow-lg lg:flex ${selected ? "right-[436px]" : "right-3"}`}>
        <button type="button" aria-label="Zoom in" onClick={() => mapCmd("zoomIn")} className="h-9 w-9 text-lg hover:bg-paper">
          +
        </button>
        <button type="button" aria-label="Zoom out" onClick={() => mapCmd("zoomOut")} className="h-9 w-9 border-t border-line text-lg hover:bg-paper">
          −
        </button>
      </div>

      {/* Right: ticket details */}
      {selected && (
        <aside aria-label="Ticket details" className="absolute inset-0 z-30 overflow-y-auto bg-white lg:inset-auto lg:bottom-[92px] lg:right-3 lg:top-16 lg:w-[420px] lg:rounded-xl lg:shadow-xl">
          <TicketPanel
            id={selected}
            onClose={() => setSelected(null)}
            onChanged={load}
            officer={officer}
            nav={
              index >= 0
                ? {
                    index,
                    total: rows.length,
                    prev: index > 0 ? () => setSelected(rows[index - 1].id) : undefined,
                    next: index < rows.length - 1 ? () => setSelected(rows[index + 1].id) : undefined,
                  }
                : undefined
            }
          />
        </aside>
      )}

      {/* Bottom: report timeline */}
      <Timeline rows={allRows} />
    </div>
  );
}

async function signOut() {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.assign("/officer/login");
}

/** Reports opened per day over the last 14 days (bars), like a dispatch timeline. */
function Timeline({ rows }: { rows: QueueRow[] }) {
  const days = 14;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
  const buckets = Array.from({ length: days }, (_, i) => ({ date: new Date(start.getFullYear(), start.getMonth(), start.getDate() + i), n: 0 }));
  for (const r of rows) {
    const i = Math.floor((new Date(r.createdAt).getTime() - start.getTime()) / 86400_000);
    if (i >= 0 && i < days) buckets[i].n++;
  }
  const max = Math.max(1, ...buckets.map((b) => b.n));
  return (
    <section aria-label="Tickets opened per day, last 14 days" className="absolute bottom-3 left-[384px] right-3 z-10 hidden h-[72px] rounded-xl bg-white px-3 pb-1.5 pt-2 shadow-xl lg:block">
      <div className="flex h-full items-end gap-1">
        {buckets.map((b, i) => (
          <div key={i} className="flex h-full flex-1 flex-col justify-end" title={`${b.date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}: ${b.n} ticket${b.n === 1 ? "" : "s"}`}>
            <div className={`rounded-sm ${i === days - 1 ? "bg-[#ff6b1a]" : "bg-[#c9c9c4]"}`} style={{ height: `${Math.max(b.n ? 8 : 2, (b.n / max) * 70)}%` }} />
            <span className="mt-1 text-center text-[10px] text-muted">{i % 2 === days % 2 || i === days - 1 ? (i === days - 1 ? "Today" : b.date.getDate()) : ""}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  const id = `f-${label.toLowerCase()}`;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[12px] text-muted">
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-full rounded-lg border border-line bg-white px-2 text-[13px]">
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}
