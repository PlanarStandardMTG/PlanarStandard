import { describe, expect, it } from "vitest";

import type { InfoPageComponent } from "@ps/contracts";

import {
  INFO_PAGE_COMPONENT_REGISTRY,
  UnavailableComponentError,
  scopeFor,
  type InfoPageComponentRegistry,
} from "./components";
import { INFO_PAGE_COMPONENTS } from "./frontmatter";

const Fake = () => null;
const registry: InfoPageComponentRegistry = { LegalSets: Fake };

describe("the info-page component whitelist", () => {
  it("is the contract's list, in one place", () => {
    // Both directions: a name the contract allows must be listed here, and this
    // list must not invent one. `INFO_PAGE_COMPONENTS` is what frontmatter
    // validates against, so a drift here is a page rendering something the
    // format never approved.
    const contractNames: InfoPageComponent[] = ["LegalSets", "Banlist", "Chart"];
    expect([...INFO_PAGE_COMPONENTS].sort()).toEqual(contractNames.sort());
  });

  it("never registers a component the whitelist does not name", () => {
    for (const name of Object.keys(INFO_PAGE_COMPONENT_REGISTRY)) {
      expect(INFO_PAGE_COMPONENTS).toContain(name);
    }
  });

  it("puts exactly the declared components in scope", () => {
    expect(Object.keys(scopeFor(["LegalSets"], registry))).toEqual(["LegalSets"]);
  });

  it("puts nothing in scope for a page that declares nothing", () => {
    expect(scopeFor(undefined, registry)).toEqual({});
  });

  it("refuses a component that is allowed but not built yet", () => {
    expect(() => scopeFor(["Chart"], registry)).toThrow(UnavailableComponentError);
    expect(() => scopeFor(["Chart"], registry)).toThrow(/E17\.4/);
  });

  it("ships the two format components, so /rules can declare them", () => {
    expect(Object.keys(scopeFor(["LegalSets", "Banlist"])).sort()).toEqual([
      "Banlist",
      "LegalSets",
    ]);
  });
});
