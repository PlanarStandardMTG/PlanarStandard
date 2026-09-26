import Link from "next/link";

import { Container } from "@/components/ui/container";

import { AccountNav } from "./account-nav";
import { DevAccountSwitcher } from "./dev-account-switcher";
import { MobileMenu } from "./mobile-menu";

/**
 * `soon` routes are in the plan but not built. Shown greyed rather than linked,
 * and rather than hidden: the shape of the site is worth advertising, and a nav
 * item that 404s is worse than one that says it is not ready.
 */
const NAV = [
  { href: "/news", label: "News" },
  { href: "/community", label: "Community" },
  { href: "/decks", label: "Decks" },
  // One info page is in the header by editorial choice rather than by
  // `navOrder`: "what is legal right now" is the question the format gets most.
  // The full generated list is in the footer.
  { href: "/rules", label: "Rules" },
  { href: "/events", label: "Events" },
  { href: "/meta", label: "Metagame", soon: true },
  { href: "/leaderboard", label: "Leaderboard" },
] as const;

const LINK = "text-ink-600 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-100";

/**
 * One line at `xl` and up; below that the logo and a menu, because seven links
 * and a signed-in admin's four account links ran a 390px header out to 1000px
 * and dragged every page sideways with it.
 */
export async function SiteHeader() {
  return (
    <header className="relative z-40 border-b border-ink-200 bg-white/80 backdrop-blur dark:border-ink-800 dark:bg-ink-950/80">
      <Container className="flex h-14 items-center justify-between gap-3 sm:gap-6">
        <Link
          href="/"
          className="shrink-0 font-serif text-base font-semibold tracking-tight whitespace-nowrap"
        >
          Planar <span className="text-eclipse-600 dark:text-eclipse-400">Standard</span>
        </Link>

        <nav aria-label="Main" className="hidden xl:block">
          <ul className="flex items-center gap-5 text-sm">
            {NAV.map((item) => (
              <li key={item.href}>
                {"soon" in item ? (
                  <span
                    className="cursor-default text-ink-400 dark:text-ink-600"
                    title="Not built yet"
                  >
                    {item.label}
                  </span>
                ) : (
                  <Link href={item.href} className={LINK}>
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <DevAccountSwitcher />
          <div className="hidden xl:block">
            <AccountNav layout="inline" />
          </div>
          <MobileMenu>
            <Container className="py-3">
              <nav aria-label="Main">
                <ul className="divide-y divide-ink-100 dark:divide-ink-900">
                  {NAV.map((item) => (
                    <li key={item.href}>
                      {"soon" in item ? (
                        <span className="block py-3 text-ink-400 dark:text-ink-600">
                          {item.label} <span className="text-xs">· coming soon</span>
                        </span>
                      ) : (
                        <Link href={item.href} className={`block py-3 ${LINK}`}>
                          {item.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>
              <div className="mt-2 border-t border-ink-200 pt-2 dark:border-ink-800">
                <AccountNav layout="stacked" />
              </div>
            </Container>
          </MobileMenu>
        </div>
      </Container>
    </header>
  );
}
