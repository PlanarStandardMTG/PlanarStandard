import { Container } from "@/components/ui/container";
import { Link } from "@/components/ui/link";
import { StarRule } from "@/components/ui/marks";
import { PlanarMark } from "@/components/ui/planar-mark";
import { COMMUNITY_LINKS } from "@/lib/community-links";

import { InfoNav } from "./info-nav";
import { MotionToggle } from "./motion-toggle";
import { ThemeToggle } from "./theme-toggle";

export function SiteFooter() {
  return (
    <footer className="border-t border-ink-200 py-10 text-sm dark:border-ink-800">
      <Container className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <PlanarMark className="size-8 text-gold-700 dark:text-gold-400" />
          <StarRule />
          <ThemeToggle />
          <MotionToggle />
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <InfoNav />
          <Link
            href="/decks/new"
            className="text-ink-600 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-100"
          >
            Check a deck <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-ink-500 dark:text-ink-400">
            A community site for the Planar Standard format.
          </p>
          <ul className="flex gap-4">
            {COMMUNITY_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="text-ink-600 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-100"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </footer>
  );
}
