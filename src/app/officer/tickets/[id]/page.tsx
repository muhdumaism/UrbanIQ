import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentOfficer } from "@/lib/auth";
import { modeInfo } from "@/lib/mode";
import { OfficerTopBar } from "@/components/officer/OfficerTopBar";
import { TicketPanel } from "@/components/officer/TicketPanel";

export const metadata: Metadata = { title: "Ticket" };
export const dynamic = "force-dynamic";

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const officer = await currentOfficer();
  if (!officer) redirect(`/officer/login?next=/officer/tickets/${encodeURIComponent(id)}`);
  return (
    <div className="min-h-dvh bg-paper">
      <OfficerTopBar officer={officer} mode={modeInfo()} />
      <main id="main" className="mx-auto max-w-3xl py-4 sm:px-4">
        <Link href={`/officer?t=${encodeURIComponent(id)}`} className="btn-ghost btn-sm mb-2 ml-2">
          ← Back to queue
        </Link>
        <div className="border-y border-line bg-surface sm:rounded-2xl sm:border">
          <TicketPanel id={id} officer={officer} standalone />
        </div>
      </main>
    </div>
  );
}
