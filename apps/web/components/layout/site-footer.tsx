import { Container } from "@/components/ui/container";

// The community's own links, as listed on the existing site's footer.
const LINKS = [
  { href: "https://discord.gg/eeYH9XMCjT", label: "Discord" },
  { href: "https://www.reddit.com/r/planarMTG/", label: "Reddit" },
  { href: "https://github.com/planarstandard", label: "GitHub" },
] as const;

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-ink-200 py-10 text-sm dark:border-ink-800">
      <Container className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
      </Container>
    </footer>
  );
}
