import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentOfficer } from "@/lib/auth";
import { modeInfo } from "@/lib/mode";
import { systemStatus } from "@/lib/system-status";
import { OfficerTopBar } from "@/components/officer/OfficerTopBar";
import { VisionTester } from "@/components/officer/VisionTester";

export const metadata: Metadata = { title: "System status" };
export const dynamic = "force-dynamic";

export default async function SystemPage() {
  const officer = await currentOfficer();
  if (!officer) redirect("/officer/login?next=/officer/system");
  const checks = await systemStatus();
  return (
    <div className="min-h-dvh bg-paper">
      <OfficerTopBar officer={officer} mode={modeInfo()} />
      <main id="main" className="mx-auto max-w-3xl px-4 py-8">
        <Link href="/officer" className="text-sm text-ink-2 underline underline-offset-2">
          ← Back to dashboard
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">System status</h1>
        <ul className="mt-6 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {checks.map((c) => (
            <li key={c.name} className="flex gap-3 px-4 py-3.5">
              <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${c.ok === true ? "bg-[#28a745]" : c.ok === false ? "bg-crit" : "bg-line-strong"}`} aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-muted"> — {c.ok === true ? "working" : c.ok === false ? "needs attention" : "info"}</span>
                </p>
                <p className="mt-0.5 break-words text-sm text-ink-2">{c.value}</p>
                {c.help && <p className="mt-1 text-sm text-muted">{c.help}</p>}
              </div>
            </li>
          ))}
        </ul>
        <VisionTester />
      </main>
    </div>
  );
}
