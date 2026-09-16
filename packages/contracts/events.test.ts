import { describe, expectTypeOf, it } from "vitest";
import type {
  EventSchedule,
  EventSource,
  EventSyncState,
  ExternalEvent,
  ExternalEventState,
} from "./events";

describe("events contracts", () => {
  it("mirrors a row of external_events column for column", () => {
    const event = {
      id: "3f1c9d2a-7b64-4e18-9c03-5a6b7c8d9e01",
      source: "challonge",
      externalId: "16042317",
      name: "Planar Standard Weekly #41",
      url: "https://challonge.com/ps_weekly_41",
      state: "scheduled",
      startsAt: "2026-09-20T19:00:00.000Z",
      participantCount: 24,
      structure: "swiss",
      fetchedAt: "2026-09-15T11:05:00.000Z",
    } satisfies ExternalEvent;
    expectTypeOf(event).toExtend<ExternalEvent>();
  });

  it("allows an event the organiser has not dated or published a page for", () => {
    const undated = {
      id: "a1b2c3d4-e5f6-4708-9a1b-2c3d4e5f6071",
      source: "challonge",
      externalId: "16042318",
      name: "Season III Opener",
      url: null,
      state: "scheduled",
      startsAt: null,
      participantCount: 0,
      structure: null,
      fetchedAt: "2026-09-15T11:05:00.000Z",
    } satisfies ExternalEvent;
    expectTypeOf(undated).toExtend<ExternalEvent>();
  });

  it("reduces every source's states to the three a schedule shows", () => {
    expectTypeOf<ExternalEventState>().toEqualTypeOf<"scheduled" | "live" | "complete">();
  });

  it("measures the refresh interval from the attempt, not the success", () => {
    const failing = {
      source: "challonge",
      lastAttemptedAt: "2026-09-15T11:05:00.000Z",
      lastSucceededAt: "2026-09-15T07:00:00.000Z",
      lastError: "challonge responded 429",
      eventCount: 7,
    } satisfies EventSyncState;
    expectTypeOf(failing.lastAttemptedAt).toExtend<string | null>();
  });

  it("has never synced before the first attempt", () => {
    const fresh = {
      source: "challonge",
      lastAttemptedAt: null,
      lastSucceededAt: null,
      lastError: null,
      eventCount: 0,
    } satisfies EventSyncState;
    expectTypeOf(fresh).toExtend<EventSyncState>();
  });

  it("gives a schedule all three groups, empty rather than absent", () => {
    const empty = { live: [], upcoming: [], past: [] } satisfies EventSchedule;
    expectTypeOf(empty).toExtend<EventSchedule>();
  });

  it("names every calendar the site caches, and nothing about how results arrive", () => {
    expectTypeOf<EventSource>().toEqualTypeOf<"challonge" | "melee">();
  });

  it("describes a melee.gg event with the same fields as a Challonge one", () => {
    const melee = {
      id: "b7e4f2a1-3c8d-4f56-9e0a-1b2c3d4e5f60",
      source: "melee",
      externalId: "289410",
      name: "Planar Standard Showdown",
      url: "https://melee.gg/Tournament/View/289410",
      state: "scheduled",
      startsAt: "2026-09-27T18:00:00.000Z",
      participantCount: 64,
      structure: "swiss",
      fetchedAt: "2026-09-15T11:05:00.000Z",
    } satisfies ExternalEvent;
    expectTypeOf(melee).toExtend<ExternalEvent>();
  });
});
