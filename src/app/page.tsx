import Link from "next/link";
import Image from "next/image";
import { Logo } from "@/components/Logo";
import { ModeBanner } from "@/components/ModeBanner";
import { SeverityBadge } from "@/components/Badges";
import { modeInfo } from "@/lib/mode";

export const dynamic = "force-dynamic";

export default function Home() {
  const mode = modeInfo();
  return (
    <>
      <ModeBanner mode={mode} />
      <div className="bg-black text-white">
        <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
          <Logo dark />
          <nav aria-label="Main" className="flex items-center gap-1 text-[15px]">
            <Link href="/track" className="rounded-full px-4 py-2 text-white/80 hover:bg-white/10 hover:text-white">
              Track a report
            </Link>
            <Link href="/officer/login" className="hidden rounded-full px-4 py-2 text-white/80 hover:bg-white/10 hover:text-white sm:inline-flex">
              Officer sign in
            </Link>
          </nav>
        </header>

        <main id="main">
          <section className="mx-auto max-w-6xl px-4 pb-14 pt-4 sm:px-6 sm:pb-20">
            <div className="overflow-hidden rounded-3xl ring-1 ring-white/10">
              <Image src="/brand/urbaniq-banner.jpg" alt="UrbanIQ — Smarter cities. Faster fixes." width={1600} height={533} priority className="h-auto w-full" />
            </div>

            <div className="mt-12 grid gap-10 sm:mt-16 lg:grid-cols-[1.3fr_1fr] lg:items-end">
              <div>
                <h1 className="text-[44px] font-semibold leading-[1.03] tracking-[-0.03em] sm:text-[68px]">Report a local issue.</h1>
                <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/75">
                  Potholes, dark streets, overflowing garbage, fallen wires. Describe it or snap a photo — UrbanIQ sends it to the team that fixes it and keeps you posted.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link href="/report" className="btn h-12 bg-[#ff6b1a] px-7 text-base font-semibold text-black hover:bg-[#ff8547]">
                    Report an issue <span aria-hidden="true">→</span>
                  </Link>
                  <Link href="/track" className="btn h-12 border border-white/25 px-6 text-base text-white hover:border-white">
                    Track a report
                  </Link>
                  <Link href="/officer/login" className="ml-1 text-[15px] text-white/70 underline decoration-white/30 underline-offset-4 hover:text-white">
                    Officer sign in
                  </Link>
                </div>
                <p className="mt-4 text-sm text-white/50">No account needed · Takes about a minute · Available across India</p>
              </div>

              {/* Product preview: report → ticket */}
              <figure aria-label="Example: a report becomes a ticket" className="rounded-2xl bg-white p-5 text-ink">
                <figcaption className="text-xs uppercase tracking-[0.14em] text-muted">Example</figcaption>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-2">“Big pothole full of water outside the school gate, cars are swerving into the other lane.”</p>
                <div className="my-4 flex items-center gap-2 text-xs text-muted">
                  <span className="h-px flex-1 bg-line" />
                  becomes
                  <span className="h-px flex-1 bg-line" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Roads · Pothole</span>
                  <SeverityBadge severity="HIGH" />
                </div>
                <p className="mt-1.5 text-sm text-ink-2">Water-filled pothole is obstructing a lane outside a school.</p>
                <p className="mt-3 text-sm">
                  <span className="text-muted">Routed to </span>
                  <span className="font-medium">Roads Maintenance</span>
                </p>
              </figure>
            </div>
          </section>
        </main>
      </div>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:grid-cols-3 sm:px-6">
        {[
          ["Describe or snap", "Write a sentence, add a photo, or both."],
          ["Pin it", "Search a place, drop a pin, or use your location."],
          ["Track it", "A private link shows every step to resolution."],
        ].map(([h, p], i) => (
          <div key={h} className="border-t-2 border-[#ff6b1a] pt-4">
            <p className="text-xs text-muted">0{i + 1}</p>
            <h2 className="mt-2 text-lg font-semibold tracking-tight">{h}</h2>
            <p className="mt-1 text-ink-2">{p}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted sm:flex-row sm:justify-between sm:px-6">
          <span>UrbanIQ — Smarter cities. Faster fixes.</span>
          <span>In an emergency, call 112 first.</span>
        </div>
      </footer>
    </>
  );
}
