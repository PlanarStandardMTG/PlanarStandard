import type { Metadata, Viewport } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { DevAccountSwitcher } from "@/components/layout/dev-account-switcher";
import { RegisterServiceWorker } from "@/components/play/register-service-worker";
import { PlanarMark } from "@/components/ui/planar-mark";
import { loginHref } from "@/lib/auth/next-path";
import { currentViewer } from "@/lib/auth/viewer";

export const metadata: Metadata = {
  title: { default: "Play", template: "%s · Play · Planar Standard" },
  description: "Pairings, results and standings for Planar Standard events.",
  manifest: "/play/manifest.webmanifest",
  appleWebApp: { capable: true, title: "PS Play", statusBarStyle: "black-translucent" },
  icons: { apple: "/play/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#0d0c17",
  // The app runs edge to edge on a phone; the header pads itself clear of the notch.
  viewportFit: "cover",
};

/**
 * The play app (E26.23, §28): a phone-first shell for running and following an event,
 * installable on its own and without the site's header and footer.
 */
export default async function PlayLayout({ children }: { children: ReactNode }) {
  const viewer = await currentViewer();
  return (
    <>
      <RegisterServiceWorker />
      <header className="sticky top-0 z-40 border-b border-ink-200 bg-paper/95 pt-[env(safe-area-inset-top)] backdrop-blur dark:border-ink-800 dark:bg-ink-950/95">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between gap-3 px-4">
          <Link
            href="/play"
            className="flex items-center gap-2 font-display text-lg tracking-tight"
          >
            <PlanarMark className="size-7 text-gold-700 dark:text-gold-400" />
            <span>
              Play <span className="text-ink-500 dark:text-ink-400">· Planar Standard</span>
            </span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <DevAccountSwitcher />
            {viewer === null ? (
              <Link
                href={loginHref("/play")}
                className="font-medium text-eclipse-700 hover:underline dark:text-eclipse-400"
              >
                Sign in
              </Link>
            ) : (
              <span className="max-w-32 truncate text-ink-600 dark:text-ink-400">
                {viewer.profile.displayName}
              </span>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pt-5 pb-[calc(2rem+env(safe-area-inset-bottom))]">
        {children}
      </main>
    </>
  );
}
