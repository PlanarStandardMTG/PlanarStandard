import type { ExternalEvent, ExternalEventState, Run, RunState } from "@ps/contracts";

const STATES: Partial<Record<RunState, ExternalEventState>> = {
  registration: "scheduled",
  running: "live",
  top_cut: "live",
  finished: "complete",
};

function structureOf(run: Pick<Run, "swissRounds" | "topCut">): string {
  if (run.swissRounds === 0) return "single elimination";
  return run.topCut >= 2 ? `swiss + top ${run.topCut}` : "swiss";
}

/**
 * A run as one more event on the schedule (E26.22), beside the Challonge and melee.gg
 * ones. Null for a draft or a cancelled run, which the schedule does not show. Its page
 * is the run's own in the play app.
 */
export function runScheduleEntry(
  run: Pick<Run, "id" | "name" | "startsAt" | "state" | "swissRounds" | "topCut">,
  entrantCount: number,
  seenAt: string,
): ExternalEvent | null {
  const state = STATES[run.state];
  if (state === undefined) return null;
  return {
    id: run.id,
    source: "site",
    externalId: run.id,
    name: run.name,
    url: `/play/events/${run.id}`,
    state,
    startsAt: run.startsAt,
    participantCount: entrantCount,
    structure: structureOf(run),
    fetchedAt: seenAt,
  };
}
