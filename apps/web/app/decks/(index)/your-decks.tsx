import type { ProfileId } from "@ps/contracts";
import { latestVersions, matchSavedDeck } from "@ps/core";
import {
  getPlayerByProfile,
  listDecksWithCards,
  listMemberDecks,
  listPlayedEntries,
  type PlayedEntry,
} from "@ps/db";
import Link from "next/link";

import { FORMAT_LABELS } from "@/components/decks/format-labels";
import { PlayedEvents } from "@/components/ui/played-events";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { formatDate } from "@/lib/format-date";
import { load } from "@/lib/load";
import { createSessionClient } from "@/lib/supabase/session";

/** The Your decks tab: a member's own decks and the events they played. */
export function YourDecks({ profileId }: { profileId: ProfileId }) {
  return (
    <>
      <OwnDecks ownerId={profileId} />
      <EventDecks profileId={profileId} />
    </>
  );
}

async function OwnDecks({ ownerId }: { ownerId: Parameters<typeof listMemberDecks>[1] }) {
  const decks = await load(async () => listMemberDecks(await createSessionClient(), ownerId));
  if (!decks.ok) return <ErrorState title="Your decks could not be loaded" detail={decks.error} />;
  if (decks.value.length === 0) {
    return <EmptyState title="No decks yet">Imported decks will be listed here.</EmptyState>;
  }

  return (
    <section aria-labelledby="own-decks">
      <h2 id="own-decks" className="mb-3 text-sm font-medium text-ink-500 dark:text-ink-400">
        Saved decks
      </h2>
      <ul className="divide-y divide-ink-200 rounded-xl border border-ink-200 dark:divide-ink-800 dark:border-ink-800">
        {latestVersions(decks.value).map(({ deck, versions }) => (
          <li key={deck.id}>
            <Link
              href={`/decks/${deck.id}`}
              className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-ink-50 dark:hover:bg-ink-900"
            >
              <span className="font-medium">{deck.name}</span>
              <span className="flex items-center gap-3 text-xs text-ink-500 dark:text-ink-400">
                <span>{FORMAT_LABELS[deck.format]}</span>
                {versions > 1 && <span>{versions} versions</span>}
                {deck.visibility !== "public" && (
                  <Badge variant="outline" className="capitalize">
                    {deck.visibility}
                  </Badge>
                )}
                {formatDate(deck.createdAt)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The events a member played, once an admin has linked them to their player
 * (E20.39), with the deck from each: one of their saved decks when the list is
 * exactly that, else the event's own copy and the saved deck it is nearest to.
 */
async function EventDecks({ profileId }: { profileId: ProfileId }) {
  const loaded = await load(async () => {
    const session = await createSessionClient();
    const player = await getPlayerByProfile(session, profileId);
    if (player === null) return null;
    const played = await listPlayedEntries(session, { playerId: player.id });
    const [decks, saved] = await Promise.all([
      listDecksWithCards(session, { ids: played.flatMap((e) => (e.deckId ? [e.deckId] : [])) }),
      listDecksWithCards(session, { savedBy: profileId }),
    ]);
    return { played, decks, saved };
  });
  if (!loaded.ok)
    return <ErrorState title="Your events could not be loaded" detail={loaded.error} />;
  if (loaded.value === null || loaded.value.played.length === 0) return null;
  const { played, decks, saved } = loaded.value;

  const describe = (entry: PlayedEntry) => {
    const deck = decks.find((d) => d.id === entry.deckId);
    if (deck === undefined) return "No decklist yet";
    const link = (
      <Link href={`/decks/${deck.id}`} className="underline-offset-2 hover:underline">
        {deck.name}
      </Link>
    );
    if (deck.submittedVia === "import") return <>Your deck {link}</>;
    const { closest } = matchSavedDeck(deck.cards, saved);
    return closest === null ? (
      link
    ) : (
      <>
        {link} · {Math.round(closest.similarity * 100)}% like your{" "}
        <Link href={`/decks/${closest.deck.id}`} className="underline-offset-2 hover:underline">
          {closest.deck.name}
        </Link>
      </>
    );
  };

  return (
    <section aria-labelledby="event-decks" className="mt-10">
      <h2 id="event-decks" className="mb-3 text-sm font-medium text-ink-500 dark:text-ink-400">
        Events you played
      </h2>
      <PlayedEvents entries={played} detail={describe} />
    </section>
  );
}
