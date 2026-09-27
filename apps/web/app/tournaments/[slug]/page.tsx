import type { EventSource } from "@ps/contracts";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { RoundPairings } from "@/components/tournaments/round-pairings";
import { StandingsList } from "@/components/tournaments/standings-list";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeading } from "@/components/ui/section-heading";
import { EmptyState } from "@/components/ui/states";
import { EVENT_SOURCE_LABELS } from "@/lib/events/source-label";
import { formatDate } from "@/lib/format-date";
import { createPublicClient } from "@/lib/supabase/server";
import { loadTournamentView } from "@/lib/tournaments/tournament-view";

/** Results change when an event is re-run or a list is attached; this page must not pin a build's copy. */
export const dynamic = "force-dynamic";

const findTournament = cache(
  async (slug: string) => await loadTournamentView(createPublicClient(), slug),
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const view = await findTournament((await params).slug);
  if (view === null) return { title: "Tournament not found" };
  return {
    title: view.tournament.name,
    description: `Standings, decklists and every round of ${view.tournament.name}, ${formatDate(view.tournament.eventDate)}.`,
  };
}

/**
 * A past event rebuilt from the site's own rows (E20.14): standings with the
 * deck each player brought, then every round's pairings and results.
 */
export default async function TournamentPage({ params }: { params: Promise<{ slug: string }> }) {
  const view = await findTournament((await params).slug);
  if (view === null) notFound();
  const { tournament, standings, rounds, decks } = view;
  const platform = platformLabel(tournament.platform);
  const players = standings.length > 0 ? standings.length : tournament.playerCount;

  return (
    <div className="night flex-1">
      <Container className="py-12">
        <PageHeader
          kicker={
            <>
              <Link href="/events" className="hover:underline">
                Events
              </Link>{" "}
              · {formatDate(tournament.eventDate)}
            </>
          }
          title={tournament.name}
          aside={
            tournament.externalUrl !== null && (
              <a
                href={tournament.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-eclipse-700 hover:underline dark:text-eclipse-400"
              >
                {platform === null ? "Event page" : `On ${platform}`}{" "}
                <span aria-hidden="true">↗</span>
              </a>
            )
          }
        >
          {[
            players === null ? null : `${players} players`,
            rounds.length > 0 ? `${rounds.length} rounds` : null,
            standings.length > 0 ? `${decks} ${decks === 1 ? "decklist" : "decklists"}` : null,
          ]
            .filter((part) => part !== null)
            .join(" · ")}
        </PageHeader>

        <div className="mb-10 flex flex-wrap items-center gap-2">
          <Badge variant={tournament.isRated ? "accent" : "outline"}>
            {tournament.isRated ? "Rated" : "Unrated"}
          </Badge>
          {tournament.structure !== null && (
            <span className="text-xs text-ink-500 capitalize dark:text-ink-400">
              {tournament.structure}
            </span>
          )}
        </div>

        {rounds.length > 0 && (
          <nav aria-label="Jump to" className="mb-10 flex flex-wrap gap-2 text-sm">
            {[{ href: "#standings", label: "Standings" }]
              .concat(rounds.map((r) => ({ href: `#round-${r.round}`, label: r.label })))
              .map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="rounded-full border border-ink-200 px-3 py-1 text-ink-600 hover:border-eclipse-500/60 hover:text-ink-900 dark:border-ink-800 dark:text-ink-300 dark:hover:text-ink-100"
                >
                  {link.label}
                </a>
              ))}
          </nav>
        )}

        <section id="standings" className="mb-12 scroll-mt-24">
          <SectionHeading>Standings</SectionHeading>
          {standings.length === 0 ? (
            <EmptyState title="No standings">
              This event&rsquo;s results have not been imported.
            </EmptyState>
          ) : (
            <StandingsList standings={standings} />
          )}
        </section>

        {rounds.map((round) => (
          <section key={round.round} id={`round-${round.round}`} className="mb-10 scroll-mt-24">
            <SectionHeading>{round.label}</SectionHeading>
            <RoundPairings round={round} />
          </section>
        ))}
      </Container>
    </div>
  );
}

function platformLabel(platform: string | null): string | null {
  return platform !== null && platform in EVENT_SOURCE_LABELS
    ? EVENT_SOURCE_LABELS[platform as EventSource]
    : null;
}
