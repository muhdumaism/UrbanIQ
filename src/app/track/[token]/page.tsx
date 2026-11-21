import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { ModeBanner } from "@/components/ModeBanner";
import { TrackingView } from "@/components/TrackingView";
import { getTrackingView } from "@/lib/citizen";
import { modeInfo } from "@/lib/mode";
import { trackingUrl } from "@/lib/tokens";

export const metadata: Metadata = { title: "Your report", referrer: "no-referrer" };
export const dynamic = "force-dynamic";

export default async function TrackPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ new?: string }> }) {
  const { token } = await params;
  const { new: isNew } = await searchParams;
  const view = await getTrackingView(token);
  const mode = modeInfo();
  return (
    <>
      <ModeBanner mode={mode} compact />
      <SiteHeader />
      <main id="main" className="mx-auto max-w-3xl px-4 pt-8 pb-16 sm:pt-12">
        {view ? (
          <TrackingView initial={view} token={token} link={trackingUrl(token)} isNew={isNew === "1"} />
        ) : (
          <div className="card p-8">
            <h1 className="text-2xl font-semibold tracking-tight">We couldn&apos;t find that report</h1>
            <p className="mt-2 text-ink-2">The tracking link may be incomplete. Copy the whole link from your confirmation and try again.</p>
            <div className="mt-6 flex gap-3">
              <Link href="/track" className="btn-dark">
                Try another link
              </Link>
              <Link href="/report" className="btn-outline">
                Report an issue
              </Link>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
