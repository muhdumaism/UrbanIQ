import Link from "next/link";
import Image from "next/image";
import { Logo } from "@/components/Logo";
import { ModeBanner } from "@/components/ModeBanner";
import { SeverityBadge } from "@/components/Badges";
import { StaticCityMap } from "@/components/StaticCityMap";
import { modeInfo } from "@/lib/mode";
import { LANDMARKS } from "@/lib/geo";

export const dynamic = "force-dynamic";

export default function Home() {
  const mode = modeInfo();
  const school = LANDMARKS.find((l) => l.name === "Alder Primary School")!;
  return (
    <>
      <ModeBanner mode={mode} />
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="flex items-center gap-1 text-[15px]">
          <Link href="/track" className="btn-ghost btn-sm">
            Track a report
          </Link>
          <Link href="/officer/login" className="btn-ghost btn-sm hidden sm:inline-flex">
            Officer sign in
          </Link>
        </nav>
      </header>

      <main id="main">
        <section className="mx-auto max-w-6xl px-4 pt-10 pb-14 sm:px-6 sm:pt-16 sm:pb-20">
          <p className="eyebrow">Port Alder municipal services · sample city</p>
          <h1 className="mt-5 max-w-3xl text-[44px] leading-[1.02] font-semibold tracking-[-0.035em] sm:text-[76px]">Report a local issue.</h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-2">
            Potholes, dark streets, overflowing bins, fallen wires. Describe it or snap a photo — we route it to the team that fixes it and keep you posted.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/report" className="btn-primary h-12 px-7 text-base">
              Report an issue <span aria-hidden="true">→</span>
            </Link>
            <Link href="/track" className="btn-outline h-12 px-6 text-base">
              Track a report
            </Link>
            <Link href="/officer/login" className="ml-1 text-[15px] text-ink-2 underline decoration-line-strong underline-offset-4 hover:decoration-ink">
              Officer sign in
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted">No account needed. Takes about a minute.</p>
        </section>

        {/* Product preview */}
        <section aria-labelledby="preview-heading" className="border-y border-line bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <div className="flex items-end justify-between gap-6">
              <h2 id="preview-heading" className="text-2xl font-semibold tracking-tight sm:text-3xl">
                From a report to a ticket the right crew can act on.
              </h2>
              <span className="hidden text-sm text-muted sm:block">Illustrative example</span>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_1.15fr_1fr]">
              <figure className="card overflow-hidden">
                <figcaption className="flex items-center justify-between border-b border-line px-5 py-3 text-sm">
                  <span className="font-medium">Citizen report</span>
                  <span className="font-mono text-xs text-muted">CF-7Q2M4K</span>
                </figcaption>
                <div className="p-5">
                  <p className="text-[15px] leading-relaxed text-ink-2">
                    “Big pothole full of water outside Alder Primary School, cars are swerving into the other lane at drop-off.”
                  </p>
                  <div className="mt-4 overflow-hidden rounded-xl border border-line">
                    <Image src="/samples/flooded-pothole.jpg" alt="Illustrative sample: a water-filled pothole in a road beside a school sign" width={600} height={450} className="h-36 w-full object-cover" />
                  </div>
                </div>
              </figure>

              <figure className="relative overflow-hidden rounded-2xl border border-night-line bg-night">
                <StaticCityMap className="h-full min-h-64 w-full" pins={[{ lat: school.lat, lng: school.lng, color: "#ff9a3c", ring: true }]} focus={{ lat: school.lat, lng: school.lng, zoom: 2.2 }} label="Map pin near Alder Primary School in Ward 2, Old Town" />
                <figcaption className="absolute left-4 bottom-4 rounded-lg bg-white/95 px-3 py-2 text-sm text-ink shadow-sm">
                  <span className="font-medium">Pinned · W2 Old Town</span>
                  <span className="block text-xs text-muted">School Road, by Alder Primary</span>
                </figcaption>
              </figure>

              <figure className="card overflow-hidden">
                <figcaption className="flex items-center justify-between border-b border-line px-5 py-3 text-sm">
                  <span className="font-medium">Ticket T-1042</span>
                  <SeverityBadge severity="HIGH" />
                </figcaption>
                <dl className="divide-y divide-line text-sm">
                  <div className="px-5 py-3">
                    <dt className="text-muted">Issue</dt>
                    <dd className="mt-0.5 font-medium">Roads · Pothole</dd>
                  </div>
                  <div className="px-5 py-3">
                    <dt className="text-muted">Why High</dt>
                    <dd className="mt-0.5">Water-filled pothole is obstructing a lane outside a school.</dd>
                  </div>
                  <div className="px-5 py-3">
                    <dt className="text-muted">Routed to</dt>
                    <dd className="mt-0.5 font-medium">Roads Maintenance</dd>
                  </div>
                </dl>
              </figure>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:grid-cols-3 sm:px-6">
          {[
            ["Describe or snap", "Write a sentence, add a photo, or both."],
            ["Pin it", "Use your location, drop a pin, or name a landmark."],
            ["Track it", "Get a private link that shows every step to resolution."],
          ].map(([h, p], i) => (
            <div key={h} className="border-t border-ink pt-4">
              <p className="font-mono text-xs text-muted">0{i + 1}</p>
              <h3 className="mt-2 text-lg font-semibold tracking-tight">{h}</h3>
              <p className="mt-1 text-ink-2">{p}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted sm:flex-row sm:justify-between sm:px-6">
          <span>CivicFlow — hackathon prototype. Port Alder is fictional; all content is sample data.</span>
          <span>In an emergency, call your local emergency number first.</span>
        </div>
      </footer>
    </>
  );
}
