import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { CitizenSignOut } from "@/components/CitizenSignOut";
import { currentCitizen } from "@/lib/citizen-auth";
import { prisma } from "@/lib/db";
import { trackingTokenFor } from "@/lib/tokens";
import { PUBLIC_STATUS_LABEL, type TicketStatusCode } from "@/lib/taxonomy";
import { TriageResultSchema } from "@/lib/ai/schema";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "My reports" };
export const dynamic = "force-dynamic";

export default async function MyReports() {
  const citizen = await currentCitizen();
  if (!citizen) redirect("/login?next=/me");
  const reports = await prisma.report.findMany({ where: { citizenId: citizen.id }, orderBy: { submittedAt: "desc" }, include: { ticket: { select: { status: true, department: { select: { name: true } } } } } });
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-2xl px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">{citizen.email ?? "Citizen"}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">My reports</h1>
          </div>
          <div className="flex gap-2">
            <Link href="/report" className="btn-primary btn-sm">
              New report
            </Link>
            <CitizenSignOut />
          </div>
        </div>
        {reports.length === 0 ? (
          <div className="card mt-8 p-8 text-center">
            <p className="font-medium">No reports yet.</p>
            <p className="mt-1 text-muted">Reports you send while signed in appear here.</p>
          </div>
        ) : (
          <ul className="mt-8 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {reports.map((r) => {
              const tri = TriageResultSchema.safeParse(r.triage);
              const status = r.ticket ? PUBLIC_STATUS_LABEL[r.ticket.status as TicketStatusCode] : r.status === "FAILED" ? "Being reviewed" : "Processing";
              return (
                <li key={r.id}>
                  <Link href={`/track/${trackingTokenFor(r.id)}`} className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-paper">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{tri.success ? tri.data.title : (r.text?.slice(0, 60) ?? "Photo report")}</span>
                      <span className="block text-sm text-muted">
                        {r.reference} · {formatDateTime(r.submittedAt)}
                        {r.ticket?.department ? ` · ${r.ticket.department.name}` : ""}
                      </span>
                    </span>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${r.ticket?.status === "RESOLVED" ? "bg-paper text-muted" : "bg-accent-soft text-accent-ink"}`}>{status}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
