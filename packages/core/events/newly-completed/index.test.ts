import type { ParsedExternalEvent } from "@ps/contracts";
import { describe, expect, it } from "vitest";

import { newlyCompleted } from "./index";

const event = (externalId: string, state: ParsedExternalEvent["state"]): ParsedExternalEvent => ({
  source: "melee",
  externalId,
  name: `Event ${externalId}`,
  url: null,
  state,
  startsAt: null,
  participantCount: 0,
  structure: null,
});

describe("core/events/newly-completed", () => {
  it("finds an event that finished since the last refresh", () => {
    const found = newlyCompleted(
      [
        { externalId: "a", state: "live" },
        { externalId: "b", state: "scheduled" },
      ],
      [event("a", "complete"), event("b", "scheduled")],
    );
    expect(found.map((e) => e.externalId)).toEqual(["a"]);
  });

  it("counts an event the cache never had, arriving already complete", () => {
    expect(newlyCompleted([], [event("new", "complete")]).map((e) => e.externalId)).toEqual([
      "new",
    ]);
  });

  it("never returns an event that was already complete, however often it is listed", () => {
    expect(
      newlyCompleted([{ externalId: "old", state: "complete" }], [event("old", "complete")]),
    ).toEqual([]);
  });

  it("ignores events that are not complete, and ones that vanished", () => {
    expect(
      newlyCompleted(
        [{ externalId: "gone", state: "live" }],
        [event("soon", "scheduled"), event("now", "live")],
      ),
    ).toEqual([]);
  });
});
