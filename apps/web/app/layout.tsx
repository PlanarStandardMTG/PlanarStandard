import type { Metadata } from "next";
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import type { ReactNode } from "react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { InlineScript } from "@/components/ui/inline-script";
import { THEME_SCRIPT } from "@/lib/preferences";

import "./globals.css";

// The old app's face, kept for continuity between versions. One weight, no italic.
const functionTwo = localFont({
  src: "./fonts/function-two-xbold.ttf",
  weight: "800",
  variable: "--font-function-two",
});
// Self-hosted by next/font at build time, so no page asks Google for anything.
const instrumentSans = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument-sans" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" });

export const metadata: Metadata = {
  title: {
    default: "Planar Standard",
    template: "%s · Planar Standard",
  },
  description:
    "Metagame analytics, an Elo leaderboard, and decklist validation for the Planar Standard format.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${functionTwo.variable} ${instrumentSans.variable} ${jetbrainsMono.variable}`}
      // The head script sets `data-theme` before React hydrates.
      suppressHydrationWarning
    >
      <head>
        <InlineScript html={THEME_SCRIPT} />
      </head>
      <body className="flex min-h-dvh flex-col font-sans">
        <SiteHeader />
        <main className="flex flex-1 flex-col">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
