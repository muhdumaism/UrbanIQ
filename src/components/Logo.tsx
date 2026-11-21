import Link from "next/link";

export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#16171a" />
      <path d="M9 20.5c3.2-1 5-3.3 6-6.6.9-2.9 3.2-4.6 7-4.9" stroke="#cdeb3f" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <circle cx="9" cy="20.5" r="2.6" fill="#cdeb3f" />
      <circle cx="22.5" cy="9" r="2" fill="#fff" />
    </svg>
  );
}

export function Logo({ href = "/", dark = false }: { href?: string; dark?: boolean }) {
  return (
    <Link href={href} className={`inline-flex items-center gap-2.5 font-semibold tracking-tight text-[17px] ${dark ? "text-white" : "text-ink"}`}>
      <LogoMark />
      CivicFlow
    </Link>
  );
}
