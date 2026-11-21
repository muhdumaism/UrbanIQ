import Link from "next/link";
import Image from "next/image";

/** UrbanIQ "U" mark (brand asset in /public/brand). */
export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return <Image src="/brand/urbaniq-mark.png" alt="" width={128} height={128} className={`${className} rounded-[22%] bg-black`} priority />;
}

/** URBANIQ wordmark: bold italic, "IQ" in brand orange. */
export function Wordmark({ dark = false, className = "text-[18px]" }: { dark?: boolean; className?: string }) {
  return (
    <span className={`font-extrabold uppercase italic tracking-tight ${dark ? "text-white" : "text-ink"} ${className}`}>
      Urban<span className="text-[#ff6b1a]">IQ</span>
    </span>
  );
}

export function Logo({ href = "/", dark = false }: { href?: string; dark?: boolean }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5" aria-label="UrbanIQ home">
      <LogoMark />
      <Wordmark dark={dark} />
    </Link>
  );
}
