import Link from "next/link";

import { Container } from "@/components/ui/container";

import { AccountNav } from "./account-nav";

/**
 * `soon` routes are in the plan but not built. Shown greyed rather than linked,
 * and rather than hidden: the shape of the site is worth advertising, and a nav
 * item that 404s is worse than one that says it is not ready.
 */
const NAV = [
  { href: "/news", label: "News" },
  { href: "/articles", label: "Articles" },
  // One info page is in the header by editorial choice rather than by
  // `navOrder`: "what is legal right now" is the question the format gets most.
  // The full generated list is in the footer.
  { href: "/rules", label: "Rules" },
  { href: "/events", label: "Events" },
  { href: "/meta", label: "Metagame", soon: true },
  { href: "/leaderboard", label: "Leaderboard", soon: true },
] as const;

export async function SiteHeader() {
  return (
    <header className="border-b border-ink-200 bg-white/80 backdrop-blur dark:border-ink-800 dark:bg-ink-950/80">
      <Container className="flex h-14 items-center justify-between gap-6">
        <Link
          href="/"
          className="shrink-0 font-serif text-base font-semibold tracking-tight whitespace-nowrap"
        >
          Planar <span className="text-eclipse-600 dark:text-eclipse-400">Standard</span>
        </Link>

        <nav aria-label="Main">
          <ul className="flex items-center gap-4 text-sm sm:gap-5">
            {NAV.map((item) => (
              <li key={item.href}>
                {"soon" in item ? (
                  // Hidden on a phone: an unclickable label is not worth the
                  // horizontal room, and four items overflowed a 390px header.
                  <span
                    className="hidden cursor-default text-ink-400 sm:inline dark:text-ink-600"
                    title="Not built yet"
                  >
                    {item.label}
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    className="text-ink-600 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-100"
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <AccountNav />
      </Container>
    </header>
  );
}
