import type { ComponentType } from "react";

import type { InfoPageComponent } from "@ps/contracts";

/**
 * The whitelist. MDX executes, so a page can only reach a component that is
 * listed here *and* declared in its own frontmatter (§25).
 *
 * `InfoPageComponent` is the set of names the format allows; this registry is
 * the subset that is actually built. A page declaring a name that is allowed but
 * not yet built fails at render with the story that will provide it, rather than
 * rendering a gap.
 */
export type InfoPageComponentRegistry = Partial<Record<InfoPageComponent, ComponentType>>;

/** Which story provides each component, for the error a page gets if it declares one early. */
const PROVIDED_BY: Record<InfoPageComponent, string> = {
  LegalSets: "E17.2",
  Banlist: "E17.3",
  Chart: "E17.4",
};

/** Empty until E17.2–E17.4 land; the mechanism around it is what E17.1 delivers. */
export const INFO_PAGE_COMPONENT_REGISTRY: InfoPageComponentRegistry = {};

export class UnavailableComponentError extends Error {}

/**
 * The MDX scope for one page: exactly the components it declared.
 *
 * What a page is *allowed* to contain is decided before this, at compile time,
 * by `remarkInfoPageWhitelist`. This supplies the implementations for what
 * survived that.
 */
export function scopeFor(
  declared: readonly InfoPageComponent[] | undefined,
  registry: InfoPageComponentRegistry = INFO_PAGE_COMPONENT_REGISTRY,
): Record<string, ComponentType> {
  const scope: Record<string, ComponentType> = {};
  for (const name of declared ?? []) {
    const component = registry[name];
    if (component === undefined) {
      throw new UnavailableComponentError(
        `<${name} /> is allowed but not built yet (${PROVIDED_BY[name]}). Remove it from \`components:\` until that story lands.`,
      );
    }
    scope[name] = component;
  }
  return scope;
}
