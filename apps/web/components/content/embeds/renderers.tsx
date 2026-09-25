import type { EmbedName } from "@ps/core";
import type { ReactNode } from "react";

/**
 * How each component shows on the site (E20.23) — the web half of
 * `core/content/embed-catalogue`, which holds the other half: its attributes
 * and how it exports.
 *
 * Keyed by every live `EmbedName`, so a component added to `EMBEDS` does not
 * compile until it has a renderer here. `renderers.test.ts` checks the same at
 * runtime, in both directions.
 *
 * `load` runs on the server, before render and before an export, and may use
 * `@ps/db` with the session client — a decklist loader can see the viewer's own
 * private decks through RLS. Whatever it returns is handed to `Render` and to
 * the component's exports in core. Throwing or returning null leaves the
 * export to fall back to a link.
 */
export interface EmbedRenderer {
  load?(attributes: Readonly<Record<string, string>>): Promise<unknown>;
  Render(props: {
    readonly attributes: Readonly<Record<string, string>>;
    readonly data: unknown;
  }): ReactNode | Promise<ReactNode>;
}

export const EMBED_RENDERERS: { readonly [N in EmbedName]: EmbedRenderer } = {};
