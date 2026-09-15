import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { formatDate } from "@/lib/format-date";
import { loadCurrentFormat } from "@/lib/format/current-format";

import type { CardRuling, FormatCardRule } from "@ps/contracts";

/**
 * E17.3 — the banlist, read from `format_card_rules` at request time.
 *
 * "Bans are data, not code" is only true if the page that publishes them reads
 * the rows. An empty banlist is a real answer and gets a real rendering: the
 * page should say nothing is banned, not look broken.
 */
const RULING_LABELS: Readonly<Record<CardRuling, string>> = {
  banned: "Banned",
  restricted: "Restricted",
  legal_exception: "Legal exception",
};

export async function Banlist() {
  const format = await loadCurrentFormat();

  if (!format.ok)
    return <ErrorState title="The banlist could not be loaded" detail={format.error} />;
  if (format.value === null) {
    return (
      <EmptyState title="No format version is current">
        Bans are rows, not code — once a version is marked current, its banlist appears here.
      </EmptyState>
    );
  }

  const { version, cardRules } = format.value;

  if (cardRules.length === 0) {
    return (
      <EmptyState title={`Nothing is banned in ${version.name}`}>
        This list is read from the database on every request, so it is current the moment an
        announcement lands.
      </EmptyState>
    );
  }

  return (
    <ul className="not-prose my-6 divide-y divide-ink-200 rounded-xl border border-ink-200 dark:divide-ink-800 dark:border-ink-800">
      {cardRules.map((rule) => (
        <li key={rule.oracleId} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-4">
          <Badge variant={rule.ruling === "banned" ? "accent" : "outline"}>
            {RULING_LABELS[rule.ruling]}
          </Badge>
          <span className="font-mono text-sm text-ink-700 dark:text-ink-300">
            {cardLabel(rule)}
          </span>
          {rule.effectiveFrom !== null && (
            <span className="text-sm text-ink-500 dark:text-ink-400">
              since {formatDate(rule.effectiveFrom)}
            </span>
          )}
          {rule.reason !== null && (
            <p className="w-full text-sm text-ink-600 dark:text-ink-400">{rule.reason}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * The oracle id, until there is a card dataset to resolve it against. `oracle_id`
 * carries no foreign key by design (§14.1) and the name lives in `data/cards/`,
 * which E4 fills.
 */
function cardLabel(rule: FormatCardRule): string {
  return rule.oracleId;
}
