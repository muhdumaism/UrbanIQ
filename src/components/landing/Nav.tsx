"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Logo } from "../Logo";

const LINKS = [
  ["How it works", "#how-it-works"],
  ["Features", "#features"],
  ["For officers", "#officers"],
  ["Track a report", "/track"],
] as const;

export function Nav({ signedIn = false }: { signedIn?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className={`sticky top-0 z-50 transition-all duration-300 ${scrolled || open ? "border-b border-zinc-200/80 bg-white/80 backdrop-blur-xl" : "border-b border-transparent bg-transparent"}`}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {LINKS.map(([l, h]) => (
            <Link key={h} href={h} className="rounded-full px-3.5 py-2 text-[14px] text-zinc-600 transition-colors hover:text-zinc-900">
              {l}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Link href={signedIn ? "/me" : "/login"} className="rounded-full px-4 py-2 text-[14px] text-zinc-600 transition-colors hover:text-zinc-900">
            {signedIn ? "My reports" : "Sign in"}
          </Link>
          <Link href="/report" className="rounded-full bg-zinc-900 px-4 py-2 text-[14px] font-medium text-white transition-colors hover:bg-zinc-700">
            Report an issue
          </Link>
        </div>
        <button type="button" className="rounded-lg p-2 text-zinc-900 md:hidden" aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((o) => !o)}>
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-zinc-200 px-5 pb-5 pt-2 md:hidden">
          {[...LINKS, (signedIn ? ["My reports", "/me"] : ["Sign in", "/login"]) as readonly [string, string], ["Officer sign in", "/officer/login"] as const].map(([l, h]) => (
            <Link key={h} href={h} onClick={() => setOpen(false)} className="block rounded-lg px-2 py-3 text-[15px] text-zinc-700 hover:bg-zinc-100">
              {l}
            </Link>
          ))}
          <Link href="/report" onClick={() => setOpen(false)} className="mt-2 block rounded-full bg-zinc-900 py-3 text-center text-[15px] font-medium text-white">
            Report an issue
          </Link>
        </nav>
      )}
    </header>
  );
}
