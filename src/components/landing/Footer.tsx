import Link from "next/link";
import { PhoneCall, ArrowUp } from "lucide-react";
import { LogoMark, Wordmark } from "../Logo";

const COLS: { title: string; links: [string, string][] }[] = [
  {
    title: "Citizens",
    links: [
      ["Report an issue", "/report"],
      ["Track a report", "/track"],
      ["How it works", "/#how-it-works"],
      ["Privacy", "/privacy"],
    ],
  },
  {
    title: "Officers",
    links: [
      ["Officer sign in", "/officer/login"],
      ["Operations dashboard", "/officer"],
      ["Dashboard features", "/#officers"],
    ],
  },
  {
    title: "We handle",
    links: [
      ["Potholes & roads", "/report"],
      ["Garbage & dumping", "/report"],
      ["Water leaks", "/report"],
      ["Streetlights", "/report"],
      ["Fallen trees & drains", "/report"],
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-zinc-200 bg-zinc-50 text-zinc-900">
      <div className="lp-grid-bg pointer-events-none absolute inset-0 opacity-50" />
      <div className="relative mx-auto max-w-7xl px-5 pb-10 pt-16 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_2fr]">
          <div>
            <div className="flex items-center gap-3">
              <LogoMark className="h-10 w-10" />
              <Wordmark className="text-[24px]" />
            </div>
            <p className="lp-display mt-4 text-[20px] font-semibold text-zinc-900">Smarter cities. Faster fixes.</p>
            <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-zinc-500">
              UrbanIQ turns citizens&apos; reports into routed, prioritised tickets, so the right crew can fix the right problem first.
            </p>
            <a href="tel:112" className="mt-6 inline-flex items-center gap-2.5 rounded-full border border-zinc-200 bg-white px-4 py-2 text-[13px] text-zinc-700 transition-colors hover:border-zinc-400">
              <PhoneCall size={15} className="text-[#ff6b1a]" />
              Emergency? Call <b className="font-semibold">112</b> first
            </a>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {COLS.map((c) => (
              <nav key={c.title} aria-label={c.title}>
                <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-zinc-400">{c.title}</h2>
                <ul className="mt-4 space-y-3">
                  {c.links.map(([l, h]) => (
                    <li key={l}>
                      <Link href={h} className="text-[14px] text-zinc-600 transition-colors hover:text-zinc-900">
                        {l}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-zinc-200 pt-6 text-[13px] text-zinc-500 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} UrbanIQ · Made in India 🇮🇳</p>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="hover:text-zinc-900">
              Privacy
            </Link>
            <Link href="/track" className="hover:text-zinc-900">
              Track a report
            </Link>
            <a href="#top" className="inline-flex items-center gap-1.5 hover:text-zinc-900">
              Back to top <ArrowUp size={14} />
            </a>
          </div>
        </div>
      </div>
      <div aria-hidden="true" className="lp-display pointer-events-none select-none overflow-hidden whitespace-nowrap text-center text-[18vw] font-extrabold uppercase italic leading-[0.8] tracking-tighter text-zinc-900/[0.04]">
        Urban<span className="text-[#ff6b1a]/[0.18]">IQ</span>
      </div>
    </footer>
  );
}
