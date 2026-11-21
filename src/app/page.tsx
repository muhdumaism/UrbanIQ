import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Camera,
  MapPin,
  Link2,
  Route,
  Flame,
  LocateFixed,
  ListOrdered,
  Copy,
  History,
  ShieldCheck,
  Smartphone,
  Bell,
  Construction,
  Trash2,
  Droplets,
  Lightbulb,
  TreePine,
  Waves,
  Zap,
  CloudRain,
} from "lucide-react";
import "@/components/landing/landing.css";
import { ModeBanner } from "@/components/ModeBanner";
import { Nav } from "@/components/landing/Nav";
import { Reveal } from "@/components/landing/Reveal";
import { HeroVisual } from "@/components/landing/HeroVisual";
import { DashboardMock } from "@/components/landing/DashboardMock";
import { Footer } from "@/components/landing/Footer";
import { modeInfo } from "@/lib/mode";
import { currentCitizen } from "@/lib/citizen-auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "UrbanIQ — Smarter cities. Faster fixes.",
  description: "Report potholes, garbage, water leaks, broken streetlights and more. UrbanIQ routes every report to the right team and keeps you posted.",
  openGraph: { title: "UrbanIQ — Smarter cities. Faster fixes.", images: ["/brand/urbaniq-banner.jpg"] },
};

const ISSUES = [
  [Construction, "Potholes"],
  [Trash2, "Garbage & dumping"],
  [Droplets, "Water leaks"],
  [Lightbulb, "Streetlights"],
  [TreePine, "Fallen trees"],
  [CloudRain, "Waterlogging"],
  [Waves, "Sewage overflow"],
  [Zap, "Electrical hazards"],
] as const;

const STEPS = [
  { icon: Camera, title: "Describe or snap", body: "Write a sentence, add a photo, or both. No app and no account." },
  { icon: MapPin, title: "Pin the spot", body: "Search a place, drop a pin, or use your location, then confirm it." },
  { icon: Route, title: "Routed instantly", body: "UrbanIQ sets the severity and sends it to the department that owns the fix." },
  { icon: Bell, title: "Track to resolution", body: "Your private link shows every update until the issue is resolved." },
];

const OFFICER_FEATURES = [
  { icon: ListOrdered, title: "One priority queue", body: "Critical first, then oldest. Urgent cases are pinned on top." },
  { icon: LocateFixed, title: "Your area first", body: "The map centres on where you work, with distance to every ticket." },
  { icon: Flame, title: "Live heatmap", body: "See where problems cluster, weighted by severity." },
  { icon: Copy, title: "Duplicates handled", body: "Repeat reports of the same issue merge into one ticket, with every citizen kept updated." },
  { icon: History, title: "Full audit trail", body: "Every action records who, when and what changed." },
];

const CITIZEN_FEATURES = [
  { icon: Smartphone, title: "Built for phones", body: "A calm, one-page form that works on any phone browser." },
  { icon: Camera, title: "Photo, text or both", body: "Snap it, describe it, or both. Whatever is quickest." },
  { icon: Link2, title: "Private tracking link", body: "No login needed. Your link shows only your report." },
  { icon: ShieldCheck, title: "Privacy built in", body: "Photo location data is stripped, and only officers can see photos." },
];

export default async function Home() {
  const mode = modeInfo();
  const citizen = await currentCitizen();
  return (
    <div id="top" className="lp bg-white text-zinc-900">
      <ModeBanner mode={mode} compact />
      <Nav signedIn={Boolean(citizen)} />

      <main id="main">
        {/* ── Hero */}
        <section className="relative overflow-hidden bg-white text-zinc-900">
          <div className="lp-grid-bg pointer-events-none absolute inset-0" />
          <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,107,26,.07),transparent)]" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-12 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:pb-28 lg:pt-20">
            <div>
              <p className="lp-in inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-[13px] text-zinc-600 shadow-sm" style={{ ["--d" as string]: "0ms" }}>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff6b1a] opacity-50" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#ff6b1a]" />
                </span>
                Civic issue reporting for Indian cities
              </p>
              <h1 className="lp-display lp-in mt-6 text-[46px] font-extrabold leading-[1.02] sm:text-[64px] lg:text-[76px]" style={{ ["--d" as string]: "80ms" }}>
                Report it.
                <br />
                Route it.
                <br />
                <span className="lp-gradient-text">Resolve it.</span>
              </h1>
              <p className="lp-in mt-6 max-w-xl text-[18px] leading-relaxed text-zinc-600" style={{ ["--d" as string]: "160ms" }}>
                Potholes, garbage, water leaks, dark streets. Tell us what you see in under a minute. UrbanIQ sends it to the team that fixes it and keeps you posted.
              </p>
              <div className="lp-in mt-9 flex flex-wrap items-center gap-3" style={{ ["--d" as string]: "240ms" }}>
                <Link href="/report" className="group inline-flex h-12 items-center gap-2 rounded-full bg-[#ff6b1a] px-7 text-[15px] font-semibold text-white transition-all hover:bg-[#f25f10] hover:shadow-[0_10px_30px_-10px_rgba(255,107,26,.6)]">
                  Report an issue <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                </Link>
                <Link href="/track" className="inline-flex h-12 items-center rounded-full border border-zinc-300 bg-white px-6 text-[15px] text-zinc-900 transition-colors hover:border-zinc-500">
                  Track a report
                </Link>
              </div>
              <dl className="lp-in mt-12 grid max-w-md grid-cols-3 gap-6 border-t border-zinc-200 pt-6" style={{ ["--d" as string]: "320ms" }}>
                {[
                  ["< 1 min", "to report"],
                  ["Google", "sign-in, optional"],
                  ["24×7", "tracking link"],
                ].map(([v, l]) => (
                  <div key={l}>
                    <dt className="sr-only">{l}</dt>
                    <dd className="lp-display text-[24px] font-bold">{v}</dd>
                    <dd className="text-[12.5px] text-zinc-500">{l}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="lp-in" style={{ ["--d" as string]: "200ms" }}>
              <HeroVisual />
            </div>
          </div>

          {/* Issue marquee */}
          <div className="lp-marquee relative border-y border-zinc-200 bg-zinc-50 py-5">
            <div className="lp-marquee-track flex w-max gap-12 pr-12">
              {[...ISSUES, ...ISSUES].map(([Icon, label], i) => (
                <span key={i} className="flex items-center gap-2.5 whitespace-nowrap text-[15px] text-zinc-500" aria-hidden={i >= ISSUES.length}>
                  <Icon size={18} className="text-zinc-400" />
                  {label}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works */}
        <section id="how-it-works" className="scroll-mt-16 bg-white py-24 text-zinc-900 sm:py-32">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <Reveal className="max-w-2xl">
              <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-zinc-500">How it works</p>
              <h2 className="lp-display mt-3 text-[36px] font-bold leading-tight sm:text-[48px]">From your phone to the right crew, in four steps.</h2>
            </Reveal>
            <ol className="relative mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div aria-hidden="true" className="absolute left-0 right-0 top-[38px] hidden h-px bg-gradient-to-r from-transparent via-zinc-300 to-transparent lg:block" />
              {STEPS.map((s, i) => (
                <Reveal as="li" key={s.title} delay={i * 110} className="lp-card relative rounded-2xl border border-zinc-200 bg-zinc-50/60 p-6">
                  <div className="flex items-center justify-between">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-800 shadow-sm">
                      <s.icon size={22} />
                    </span>
                    <span className="lp-display text-[40px] font-extrabold text-zinc-900/[0.06]">0{i + 1}</span>
                  </div>
                  <h3 className="lp-display mt-6 text-[19px] font-bold">{s.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-zinc-500">{s.body}</p>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Officers */}
        <section id="officers" className="relative scroll-mt-16 overflow-hidden border-y border-zinc-200 bg-zinc-50 py-24 text-zinc-900 sm:py-32">
          <div className="lp-grid-bg pointer-events-none absolute inset-0 opacity-70" />
          <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
            <div className="grid items-center gap-14 lg:grid-cols-[1fr_1.35fr]">
              <div>
                <Reveal>
                  <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-zinc-500">For city officers</p>
                  <h2 className="lp-display mt-3 text-[36px] font-bold leading-tight sm:text-[48px]">See the whole city. Act on what matters first.</h2>
                  <p className="mt-4 text-[17px] leading-relaxed text-zinc-600">A calm operations view: one queue, one map, and every decision recorded.</p>
                </Reveal>
                <ul className="mt-10 space-y-5">
                  {OFFICER_FEATURES.map((f, i) => (
                    <Reveal as="li" key={f.title} delay={i * 80} className="flex gap-4">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700">
                        <f.icon size={19} />
                      </span>
                      <span>
                        <span className="block text-[16px] font-semibold">{f.title}</span>
                        <span className="mt-0.5 block text-[14.5px] leading-relaxed text-zinc-500">{f.body}</span>
                      </span>
                    </Reveal>
                  ))}
                </ul>
                <Reveal delay={200}>
                  <Link href="/officer/login" className="group mt-10 inline-flex items-center gap-2 text-[15px] font-semibold text-zinc-900 hover:text-[#f26b21]">
                    Officer sign in <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
                  </Link>
                </Reveal>
              </div>
              <Reveal delay={150} className="relative">
                <div className="lp-glow absolute -inset-8 opacity-60" />
                <div className="relative">
                  <DashboardMock />
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── Citizens */}
        <section id="features" className="scroll-mt-16 bg-white py-24 text-zinc-900 sm:py-32">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <Reveal className="mx-auto max-w-2xl text-center">
              <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-zinc-500">For citizens</p>
              <h2 className="lp-display mt-3 text-[36px] font-bold leading-tight sm:text-[48px]">Reporting that respects your time.</h2>
            </Reveal>
            <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {CITIZEN_FEATURES.map((f, i) => (
                <Reveal key={f.title} delay={i * 90} className="lp-card group rounded-2xl border border-zinc-200 bg-white p-6 hover:border-zinc-300">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 transition-colors group-hover:bg-[#fff4ed] group-hover:text-[#f26b21]">
                    <f.icon size={21} />
                  </span>
                  <h3 className="lp-display mt-5 text-[18px] font-bold">{f.title}</h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-zinc-500">{f.body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA */}
        <section className="bg-white px-5 pb-24 sm:px-8 sm:pb-32">
          <Reveal className="relative mx-auto max-w-7xl overflow-hidden rounded-[32px] border border-zinc-200 bg-zinc-50 px-8 py-16 text-zinc-900 sm:px-16 sm:py-20">
            <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full bg-[radial-gradient(closest-side,rgba(255,107,26,.10),transparent)]" />
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 left-1/3 h-96 w-96 rounded-full bg-[radial-gradient(closest-side,rgba(24,24,27,.05),transparent)]" />
            <div className="relative flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-end">
              <div>
                <h2 className="lp-display max-w-2xl text-[36px] font-extrabold leading-[1.05] sm:text-[52px]">Seen something broken? Report it in a minute.</h2>
                <p className="mt-4 max-w-xl text-[17px] text-zinc-600">Your report goes straight to the team that fixes it. No sign-up needed.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/report" className="group inline-flex h-12 items-center gap-2 rounded-full bg-[#ff6b1a] px-7 text-[15px] font-semibold text-white transition-all hover:bg-[#f25f10]">
                  Report an issue <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                </Link>
                <Link href="/track" className="inline-flex h-12 items-center rounded-full border border-zinc-300 bg-white px-6 text-[15px] font-medium transition-colors hover:border-zinc-500">
                  Track a report
                </Link>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <Footer />
    </div>
  );
}
