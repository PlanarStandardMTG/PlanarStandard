import { Container } from "@/components/ui/container";
import { StarRule } from "@/components/ui/marks";
import { PlanarMark } from "@/components/ui/planar-mark";

import { InfoNav } from "./info-nav";

// The community's own links, as listed on the existing site's footer.
const LINKS = [
  { href: "https://discord.gg/eeYH9XMCjT", label: "Discord" },
  { href: "https://www.reddit.com/r/planarMTG/", label: "Reddit" },
  { href: "https://github.com/planarstandard", label: "GitHub" },
] as const;

export function SiteFooter() {
  return (
    <footer className="night py-10 text-sm">
      <Container className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <PlanarMark className="size-8 text-gold-400" />
          <StarRule />
        </div>
        <InfoNav />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-ink-500 dark:text-ink-400">
            Every number on this site is computed from data you can read, by code you can read.
          </p>
          <ul className="flex gap-4">
            {LINKS.map((link) => (
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
