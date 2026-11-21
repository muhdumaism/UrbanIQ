import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "UrbanIQ — Report a local issue", template: "%s · UrbanIQ" },
  description: "Report potholes, broken lights, waste and hazards. UrbanIQ routes your report to the right team and keeps you posted.",
  robots: { index: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f6f6f1" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh font-sans">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-surface focus:px-3 focus:py-2 focus:rounded-lg">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
