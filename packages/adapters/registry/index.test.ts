import type { ParsedEvent, RawInput, ResultsAdapter } from "@ps/contracts";
import { describe, expect, it } from "vitest";

import { adapterById, defaultRegistry, detectAdapter } from "./index";

const upload = (fileName: string, text: string): RawInput => ({
  fileName,
  bytes: new TextEncoder().encode(text),
  text,
});

const EMPTY: ParsedEvent = { capabilities: [], issues: [] };

const stub = (id: string, detects: boolean | (() => never)): ResultsAdapter => ({
  id,
  capabilities: ["matches"],
  detect: typeof detects === "function" ? detects : () => detects,
  parse: () => EMPTY,
});

describe("adapters/registry", () => {
  it("matches the manual-entry payload", () => {
    const detection = detectAdapter(
      upload("entry.json", '{"adapter":"manual-entry","matches":[]}'),
    );

    expect(detection.outcome).toBe("matched");
    expect(detection.outcome === "matched" && detection.adapter.id).toBe("manual-entry");
  });

  it("falls through to generic-csv for a file nothing else claims", () => {
    const detection = detectAdapter(upload("pairings.csv", "P1,P2,Result\na,b,win\n"));

    expect(detection.outcome === "matched" && detection.adapter.id).toBe("generic-csv");
  });

  it("reports two claimants instead of picking the first registered", () => {
    const registry = [{ adapter: stub("alpha", true) }, { adapter: stub("beta", true) }];
    const detection = detectAdapter(upload("x.csv", "a,b"), registry);

    expect(detection.outcome).toBe("ambiguous");
    if (detection.outcome !== "ambiguous") return;
    expect(detection.candidates.map((a) => a.id)).toEqual(["alpha", "beta"]);
    expect(detection.issue.message).toContain("alpha, beta");
  });

  it("reports the same ambiguity with the order reversed", () => {
    const forward = detectAdapter(upload("x.csv", "a,b"), [
      { adapter: stub("alpha", true) },
      { adapter: stub("beta", true) },
    ]);
    const backward = detectAdapter(upload("x.csv", "a,b"), [
      { adapter: stub("beta", true) },
      { adapter: stub("alpha", true) },
    ]);

    expect(forward.outcome).toBe("ambiguous");
    expect(backward.outcome).toBe(forward.outcome);
  });

  it("prefers a specific adapter to the floor, and that is a role not a position", () => {
    const registry = [
      { adapter: stub("generic", true), fallback: true },
      { adapter: stub("melee", true) },
    ];
    const detection = detectAdapter(upload("x.csv", "a,b"), registry);

    expect(detection.outcome === "matched" && detection.adapter.id).toBe("melee");
  });

  it("is unrecognized when nothing claims the file, and says what to do", () => {
    const detection = detectAdapter(upload("bracket.pdf", "%PDF-1.7"));

    expect(detection.outcome).toBe("unrecognized");
    if (detection.outcome !== "unrecognized") return;
    expect(detection.issue.code).toBe("unrecognized-format");
    expect(detection.issue.message).toContain("bracket.pdf");
    expect(detection.issue.message).toContain("generic-csv");
  });

  it("treats an adapter that throws in detect as a no", () => {
    const registry = [
      {
        adapter: stub("broken", () => {
          throw new Error("boom");
        }),
      },
      { adapter: stub("working", true) },
    ];

    expect(detectAdapter(upload("x.csv", "a,b"), registry).outcome).toBe("matched");
  });

  it("finds a shipped adapter by the id an import recorded", () => {
    expect(adapterById("generic-csv")?.id).toBe("generic-csv");
    expect(adapterById("melee-csv")).toBeNull();
  });

  it("ships every adapter with a distinct id", () => {
    const ids = defaultRegistry.map((entry) => entry.adapter.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
