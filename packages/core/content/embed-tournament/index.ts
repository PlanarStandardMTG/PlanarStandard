import type { IsoDate, WinLossDraw } from "@ps/contracts";

import {
  deckCounts,
  deckHref,
  deckListBlock,
  parseDeckId,
  type DecklistEmbedData,
} from "../embed-decklist/index";
import { defineEmbed, type EmbedParse } from "../embed-registry/index";

/**
 * `:::tournament{slug="…" show="top4" deck="…" player="…"}` — an event's
 * result in a post (E20.36): its winner, top two or top four, and optionally
 * a deck.
 *
 * With `player`, the deck is that finisher's and sits under their row; without
 * it the deck is paired with the event and sits under the standings. Either
 * way the site shows one card, and every export writes the event and the deck
 * out one after the other, the deck as `embed-decklist` writes it.
 */
export type TournamentShow = "winner" | "top2" | "top4";

export const TOURNAMENT_SHOW: Readonly<Record<TournamentShow, { label: string; through: number }>> =
  {
    winner: { label: "Winner", through: 1 },
    top2: { label: "Top 2", through: 2 },
    top4: { label: "Top 4", through: 4 },
  };

export interface TournamentEmbed {
  readonly slug: string;
  readonly show: TournamentShow;
  readonly deck: string | null;
  /** The finisher the deck belongs to, by player slug. Null pairs it with the event. */
  readonly player: string | null;
}

export interface TournamentFinish {
  readonly placement: number;
  readonly playerSlug: string | null;
  readonly name: string;
  readonly record: WinLossDraw;
}

export interface TournamentEmbedData {
  readonly name: string;
  readonly date: IsoDate;
  readonly playerCount: number | null;
  /** The event on its platform. Null when the source gave no address. */
  readonly url: string | null;
  /** Placed finishers within `show`, best first. Empty when no standings were reported. */
  readonly finishers: readonly TournamentFinish[];
  readonly deck: DecklistEmbedData | null;
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseTournamentEmbed(
  raw: Readonly<Record<string, string>>,
): EmbedParse<TournamentEmbed> {
  const slug = raw["slug"]?.trim() ?? "";
  const show = raw["show"]?.trim() || "top4";
  const deck = raw["deck"]?.trim() ?? "";
  const player = raw["player"]?.trim() ?? "";

  if (slug === "") return { ok: false, problem: "needs a tournament slug" };
  if (!SLUG.test(slug)) return { ok: false, problem: "slug must be a tournament's slug" };
  if (!(show in TOURNAMENT_SHOW)) return { ok: false, problem: "show is winner, top2 or top4" };
  if (player !== "" && deck === "") return { ok: false, problem: "player needs a deck to go with" };

  const deckId = deck === "" ? null : parseDeckId(deck, "deck");
  if (deckId !== null && !deckId.ok) return deckId;

  return {
    ok: true,
    value: {
      slug,
      show: show as TournamentShow,
      deck: deckId?.value ?? null,
      player: player === "" ? null : player,
    },
  };
}

/** "1st", "2nd", "3rd", "11th". */
export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${suffix}`;
}

/** "4-0", or "3-1-1" with draws. */
export function formatRecord(record: WinLossDraw): string {
  const draws = record.draws ?? 0;
  return `${record.wins}-${record.losses}${draws > 0 ? `-${draws}` : ""}`;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "4 October 2026", read off the ISO date so no time zone can move it. */
export function longDate(date: IsoDate): string {
  const [year, month, day] = date.split("-").map(Number);
  return `${day ?? ""} ${MONTHS[(month ?? 1) - 1] ?? ""} ${year ?? ""}`;
}

/** The finisher the deck is attached to, when `player` names one who is shown. */
export function deckOwner(
  embed: TournamentEmbed,
  data: TournamentEmbedData,
): TournamentFinish | null {
  return embed.player === null
    ? null
    : (data.finishers.find((f) => f.playerSlug === embed.player) ?? null);
}

function reddit(embed: TournamentEmbed, data: TournamentEmbedData | null, origin: string): string {
  if (data === null) {
    const deck = embed.deck === null ? [] : [`[Decklist](${deckHref(origin, embed.deck)})`];
    return [`**Tournament:** ${embed.slug}`, ...deck].join("\n\n");
  }

  const title = data.url === null ? `**${data.name}**` : `**[${data.name}](${data.url})**`;
  const players = data.playerCount === null ? [] : [`${data.playerCount} players`];
  const heading = [title, longDate(data.date), ...players].join(" · ");
  const standings =
    data.finishers.length === 0
      ? "*No standings were reported for this event.*"
      : data.finishers
          .map((f) => `- **${ordinal(f.placement)}** ${f.name} (${formatRecord(f.record)})`)
          .join("\n");

  const blocks = [heading, standings];
  if (embed.deck !== null && data.deck !== null) {
    const owner = deckOwner(embed, data);
    const whose = owner === null ? "Deck" : `${owner.name}'s deck (${ordinal(owner.placement)})`;
    const link = `[${data.deck.name}](${deckHref(origin, embed.deck)})`;
    blocks.push(`**${whose}:** ${link} · ${deckCounts(data.deck)}`, deckListBlock(data.deck));
  } else if (embed.deck !== null) {
    blocks.push(`[Decklist](${deckHref(origin, embed.deck)})`);
  }
  return blocks.join("\n\n");
}

function discord(embed: TournamentEmbed, data: TournamentEmbedData | null, origin: string): string {
  const deckLine =
    embed.deck === null
      ? []
      : [`Deck${data?.deck ? `: **${data.deck.name}**` : ""} ${deckHref(origin, embed.deck)}`];
  if (data === null) return [`Tournament: ${embed.slug}`, ...deckLine].join("\n");

  const players = data.playerCount === null ? "" : ` · ${data.playerCount} players`;
  const standings = data.finishers
    .map((f) => `${ordinal(f.placement)} ${f.name} (${formatRecord(f.record)})`)
    .join(" · ");
  return [
    `**${data.name}** · ${longDate(data.date)}${players}`,
    ...(standings === "" ? [] : [standings]),
    ...(data.url === null ? [] : [data.url]),
    ...deckLine,
  ].join("\n");
}

export const tournamentEmbed = defineEmbed<"tournament", TournamentEmbed, TournamentEmbedData>({
  name: "tournament",
  label: "Tournament",
  description: "An event's winner, top 2 or top 4, with a deck in it or beside it.",
  attributes: [
    { name: "slug", required: true, description: "Which event." },
    { name: "show", required: false, description: "winner, top2 or top4 (the default)." },
    { name: "deck", required: false, description: "A deck id to show with the event." },
    { name: "player", required: false, description: "The finisher the deck belongs to." },
  ],
  parse: parseTournamentEmbed,
  export: {
    reddit: (embed, data, { origin }) => reddit(embed, data, origin),
    discord: (embed, data, { origin }) => discord(embed, data, origin),
  },
});
