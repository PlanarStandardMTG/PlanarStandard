import { seasonProgress } from "@ps/core";
import { getCurrentSeason } from "@ps/db";

import { SeasonRing } from "@/components/ui/marks";
import { load } from "@/lib/load";
import { createPublicClient } from "@/lib/supabase/server";

/**
 * Where we are in the current season: the ring of stars and "Week 9 of 12".
 * Absent between seasons, and when the season cannot be read — it is a
 * decoration, and never worth an error.
 */
export async function SeasonBadge({ large = false }: { large?: boolean }) {
  const season = await load(() => getCurrentSeason(createPublicClient()));
  if (!season.ok || season.value === null) return null;
  const progress = seasonProgress(season.value, new Date());
  if (progress === null) return null;

  const week = `Week ${progress.week}${progress.weeks === null ? "" : ` of ${progress.weeks}`}`;
  return (
    <div className="flex shrink-0 items-center gap-3">
      <SeasonRing progress={progress} className={large ? "size-24" : "size-7"} />
      {large ? (
        <div>
          <p className="font-serif text-3xl">{week}</p>
          <p className="font-mono text-xs tracking-[0.14em] text-ink-500 uppercase dark:text-ink-400">
            {season.value.name}
          </p>
        </div>
      ) : (
        <p className="font-mono text-xs tracking-[0.08em] text-ink-400 uppercase">
          {season.value.name} · {week}
        </p>
      )}
    </div>
  );
}
