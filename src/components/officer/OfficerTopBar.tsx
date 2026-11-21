"use client";
import Link from "next/link";
import { LogoMark, Wordmark } from "../Logo";
import type { SessionOfficer } from "@/lib/auth";
import type { ModeInfo } from "@/lib/mode";

export function OfficerTopBar({ officer, mode }: { officer: SessionOfficer; mode: ModeInfo }) {
  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/officer/login");
  };
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line bg-surface px-4">
      <div className="flex min-w-0 items-center gap-3">
        <Link href="/officer" className="flex items-center gap-2 font-semibold tracking-tight">
          <LogoMark className="h-6 w-6" />
          <Wordmark className="hidden text-[16px] sm:inline" />
          <span className="hidden text-muted sm:inline">/ Operations</span>
        </Link>
        {mode.demo ? (
          <span className="chip border-[#e85d10] bg-accent text-ink" title="Rule-based triage, no live AI">
            Demo mode
          </span>
        ) : !mode.liveAi ? (
          <span className="chip border-[#f1c9a5] bg-high-soft text-high">Live AI key missing</span>
        ) : null}
      </div>
      <div className="flex items-center gap-3 text-sm">
        <span className="hidden text-right leading-tight md:block">
          <span className="block font-medium">{officer.name}</span>
          <span className="block text-xs text-muted">{officer.role === "SUPERVISOR" ? "Supervisor · all departments" : officer.departmentName}</span>
        </span>
        <button onClick={signOut} className="btn-outline btn-sm">
          Sign out
        </button>
      </div>
    </header>
  );
}
