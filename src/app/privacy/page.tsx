import type { Metadata } from "next";
import "@/components/landing/landing.css";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";

export const metadata: Metadata = { title: "Privacy" };

const ITEMS = [
  ["No account needed", "You can report an issue without signing up. We don't ask for your name, phone number or email."],
  ["Your mobile number", "Only if you choose to sign in. It is used to send your one-time sign-in code and to list your own reports. We never show it to other citizens or use it for marketing."],
  ["Your photo", "Photos are re-encoded on upload and their hidden metadata (including GPS and camera details) is removed. Only signed-in city officers can view them; they are never public."],
  ["Your location", "We store the point you confirm on the map and anything you type. If you pick a place from search, we store only Google's place ID, not Google's place details."],
  ["Your tracking link", "Your link is private and unguessable. Anyone with it can see your report's status, so share it carefully. It never shows other people's reports."],
  ["What officers see", "Officers see your description, photo and location to fix the issue. Internal notes stay internal; you see public updates and the resolution note."],
  ["Officer location", "The officer dashboard can use an officer's browser location to show nearby tickets. It stays in their browser and is never stored."],
] as const;

export default function PrivacyPage() {
  return (
    <div className="lp min-h-dvh bg-white">
      <Nav />
      <main id="main" className="bg-white text-zinc-900">
        <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Privacy</p>
          <h1 className="lp-display mt-3 text-[40px] font-bold leading-tight sm:text-[52px]">Your report, kept simple and private.</h1>
          <p className="mt-4 text-[17px] leading-relaxed text-[#3a3d42]">Here is exactly what UrbanIQ stores when you report a civic issue, and who can see it.</p>
          <dl className="mt-12 divide-y divide-[#e2e2da] border-y border-[#e2e2da]">
            {ITEMS.map(([t, d]) => (
              <div key={t} className="grid gap-2 py-6 sm:grid-cols-[200px_1fr] sm:gap-8">
                <dt className="lp-display text-[16px] font-semibold">{t}</dt>
                <dd className="text-[15px] leading-relaxed text-[#3a3d42]">{d}</dd>
              </div>
            ))}
          </dl>
        </div>
      </main>
      <Footer />
    </div>
  );
}
