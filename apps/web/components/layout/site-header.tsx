import Link from "next/link";

import { Container } from "@/components/ui/container";
import { PlanarMark } from "@/components/ui/planar-mark";

import { AccountNav } from "./account-nav";
import { DevAccountSwitcher } from "./dev-account-switcher";
import { MobileMenu } from "./mobile-menu";

const NAV = [
  { href: "/news", label: "News" },
  { href: "/community", label: "Community" },
  { href: "/decks", label: "Decks" },
  // One info page is in the header by editorial choice rather than by
  // `navOrder`: "what is legal right now" is the question the format gets most.
  // The full generated list is in the footer.
  { href: "/rules", label: "Rules" },
  { href: "/events", label: "Events" },
  { href: "/leaderboard", label: "Leaderboard" },
] as const;

const LINK = "text-ink-600 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-100";

/**
 * One line at `xl` and up; below that the logo and a menu, because six links
 * and a signed-in admin's four account links ran a 390px header out to 1000px
 * and dragged every page sideways with it.
 */
export async function SiteHeader() {
  return (
    <header className="relative z-40 border-b border-ink-200 dark:border-ink-800">
      <Container className="flex h-16 items-center justify-between gap-3 sm:gap-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 font-display text-xl tracking-tight whitespace-nowrap"
        >
          <PlanarMark className="size-8 text-gold-700 dark:text-gold-400" />
          <span>
            Planar <em className="text-gold-700 dark:text-gold-400">Standard</em>
          </span>
        </Link>

        <nav aria-label="Main" className="hidden xl:block">
          <ul className="flex items-center gap-5 text-sm">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={LINK}>
                  {item.label}
                </Link>
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
                      <Link href={item.href} className={`block py-3 ${LINK}`}>
                        {item.label}
                      </Link>
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
