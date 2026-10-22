import type { Metadata } from "next";
import localFont from "next/font/local";

import "./globals.css";

const fraunces = localFont({
  src: "./fonts/fraunces-latin.woff2",
  variable: "--font-fraunces",
  display: "swap",
  weight: "300 700",
  fallback: ["Iowan Old Style", "Palatino Linotype", "Georgia", "serif"],
});

const manrope = localFont({
  src: "./fonts/manrope-latin.woff2",
  variable: "--font-manrope",
  display: "swap",
  weight: "300 800",
  fallback: ["Helvetica Neue", "Arial", "sans-serif"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Eventora AI — Your imagination. Intelligently orchestrated.",
    template: "%s · Eventora AI",
  },
  description:
    "A premium AI celebration studio: ML cost estimates, a recommendation engine, budget-risk triage, and a generative planning assistant for weddings, birthdays, festivals, and corporate events.",
  applicationName: "Eventora AI",
  openGraph: {
    title: "Eventora AI — The Editorial Event Atelier",
    description: "Plan celebrations with honest cost intelligence and a real AI planning assistant.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${manrope.variable}`}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-ink focus:px-4 focus:py-2 focus:text-ivory"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
