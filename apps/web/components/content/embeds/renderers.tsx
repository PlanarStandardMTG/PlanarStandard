import type { TournamentId } from "@ps/contracts";
import {
  TOURNAMENT_SHOW,
  deckOwner,
  formatRecord,
  longDate,
  parseDecklistEmbed,
  parseImageEmbed,
  parseTournamentEmbed,
  type EmbedName,
  type TournamentEmbedData,
} from "@ps/core";
import { getTournamentBySlug, listTournamentFinishers } from "@ps/db";
import type { ReactNode } from "react";

import { createSessionClient } from "@/lib/supabase/session";

import { DotLeader, Placement } from "@/components/ui/marks";

import { DeckPanel } from "./deck-panel";
import { loadDeck, type LoadedDeck } from "./load-deck";

/**
 * How each component shows on the site (E20.23) — the web half of
 * `core/content/embed-catalogue`, which holds the other half: its attributes
 * and how it exports.
 *
 * Keyed by every live `EmbedName`, so a component added to `EMBEDS` does not
 * compile until it has a renderer here. `renderers.test.ts` checks the same at
 * runtime, in both directions.
 *
 * `load` runs on the server, before render and before an export, and may use
 * `@ps/db` with the session client — a decklist loader can see the viewer's own
 * private decks through RLS. Whatever it returns is handed to `Render` and to
 * the component's exports in core. Throwing or returning null leaves the
 * export to fall back to a link.
 *
 * Every `Render` wears `not-prose`, so the post's typography leaves its
 * headings, lists and links alone.
 */
export interface EmbedRenderer {
  load?(attributes: Readonly<Record<string, string>>): Promise<unknown>;
  Render(props: {
    readonly attributes: Readonly<Record<string, string>>;
    readonly data: unknown;
  }): ReactNode | Promise<ReactNode>;
}

type LoadedTournament = TournamentEmbedData & { readonly deck: LoadedDeck | null };

const CARD =
  "not-prose my-6 rounded-lg border font-sans text-base border-ink-200 bg-paper p-4 sm:p-5 dark:border-ink-800 dark:bg-ink-900";
/** An event is a ledger, so it is night on any page. */
const NIGHT_CARD = `${CARD} night`;

export const EMBED_RENDERERS: { readonly [N in EmbedName]: EmbedRenderer } = {
  image: {
    Render({ attributes }) {
      const image = parseImageEmbed(attributes);
      if (!image.ok) return null;
      const { src, alt, caption } = image.value;
      return (
        <figure className="not-prose my-6">
          {/* Not next/image: it would need every host an author links to allow-listed. */}
          <img
            src={src}
            alt={alt}
            loading="lazy"
            className="mx-auto h-auto max-w-full rounded-lg"
          />
          {caption !== null && (
            <figcaption className="mt-2 text-center text-sm text-ink-500 dark:text-ink-400">
              {caption}
            </figcaption>
          )}
        </figure>
      );
    },
  },

  decklist: {
    async load(attributes) {
      const call = parseDecklistEmbed(attributes);
      return call.ok ? await loadDeck(call.value.id) : null;
    },
    Render({ attributes, data }) {
      const call = parseDecklistEmbed(attributes);
      const deck = data as LoadedDeck | null;
      return (
        <section className={CARD}>
          {deck === null ? (
            <Missing>This deck is private, removed, or does not exist.</Missing>
          ) : (
            <DeckPanel deck={deck} title={call.ok ? call.value.title : null} />
          )}
        </section>
      );
    },
  },

  tournament: {
    async load(attributes): Promise<LoadedTournament | null> {
      const call = parseTournamentEmbed(attributes);
      if (!call.ok) return null;
      const session = await createSessionClient();
      const event = await getTournamentBySlug(session, call.value.slug);
      if (event === null) return null;

      const [finishers, deck] = await Promise.all([
        listTournamentFinishers(
          session,
          event.id as TournamentId,
          TOURNAMENT_SHOW[call.value.show].through,
        ),
        call.value.deck === null ? null : loadDeck(call.value.deck),
      ]);
      return {
        name: event.name,
        date: event.eventDate,
        playerCount: event.playerCount,
        url: event.externalUrl,
        finishers: finishers.map((f) => ({
          placement: f.placement,
          playerSlug: f.playerSlug,
          name: f.displayName ?? "A hidden player",
          record: f.record,
        })),
        deck,
      };
    },
    Render({ attributes, data }) {
      const call = parseTournamentEmbed(attributes);
      const event = data as LoadedTournament | null;
      if (!call.ok || event === null) {
        return (
          <section className={NIGHT_CARD}>
            <Missing>This tournament could not be found.</Missing>
          </section>
        );
      }

      const owner = deckOwner(call.value, event);
      const deck = event.deck;
      const missingDeck = call.value.deck !== null && deck === null;

      return (
        <section className={NIGHT_CARD}>
          <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h3 className="min-w-0 font-serif text-2xl text-ink-900 dark:text-ink-100">
              {event.url === null ? (
                event.name
              ) : (
                <a href={event.url} className="hover:underline" rel="noreferrer">
                  {event.name}
                </a>
              )}
            </h3>
            <span className="rounded-full shrink-0 bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-700 dark:bg-ink-800 dark:text-ink-300">
              {TOURNAMENT_SHOW[call.value.show].label}
            </span>
          </header>
          <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
            {longDate(event.date)}
            {event.playerCount !== null && ` · ${event.playerCount} players`}
          </p>

          {event.finishers.length === 0 ? (
            <p className="mt-4 text-sm text-ink-600 dark:text-ink-400">
              No standings were reported for this event.
            </p>
          ) : (
            <ol className="mt-4 divide-y divide-ink-100 dark:divide-ink-800/60">
              {event.finishers.map((finish) => (
                <li key={`${finish.placement}-${finish.playerSlug}`} className="py-2">
                  <div className="flex items-center gap-2">
                    <Placement place={finish.placement} className="text-xl" />
                    <span className="min-w-0 truncate font-semibold">{finish.name}</span>
                    <DotLeader />
                    <span className="shrink-0 font-mono text-sm">
                      {formatRecord(finish.record)}
                    </span>
                  </div>
                  {deck !== null && owner?.playerSlug === finish.playerSlug && (
                    <div className="mt-3 mb-1 rounded-lg bg-ink-50 p-3 sm:ml-12 dark:bg-ink-950/70">
                      <DeckPanel deck={deck} />
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}

          {deck !== null && owner === null && (
            <div className="mt-4 border-t border-ink-200 pt-4 dark:border-ink-800">
              <DeckPanel deck={deck} />
            </div>
          )}
          {missingDeck && (
            <div className="mt-4">
              <Missing>The deck is private, removed, or does not exist.</Missing>
            </div>
          )}
        </section>
      );
    },
  },
};

function Missing({ children }: { children: ReactNode }) {
  return <p className="text-sm text-ink-500 dark:text-ink-400">{children}</p>;
}
