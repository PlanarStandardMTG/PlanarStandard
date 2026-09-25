import { EMBED_REGISTRY, PLANNED_EMBEDS, parseEmbedLine } from "@ps/core";

import { loadEmbed } from "./load";
import { EMBED_RENDERERS, type EmbedRenderer } from "./renderers";

const RENDERERS: Readonly<Record<string, EmbedRenderer>> = EMBED_RENDERERS;

/**
 * One component in a post, on the site (E20.23). A server component, so a
 * renderer's `load` can read the database before anything reaches the browser.
 *
 * Anything it cannot render says so in the page rather than vanishing — the
 * author sees it in preview, and submission refuses it (`core/post-draft`).
 */
export async function EmbedBlock({ source }: { source: string }) {
  const call = parseEmbedLine(source);
  if (call === null) return <Placeholder title="Unreadable component" detail={source} />;

  const embed = EMBED_REGISTRY.find((e) => e.name === call.name);
  const renderer = RENDERERS[call.name];

  if (embed === undefined || renderer === undefined) {
    const planned = PLANNED_EMBEDS.find((p) => p.name === call.name);
    return planned === undefined ? (
      <Placeholder title={`No component called “${call.name}”`} detail={source} />
    ) : (
      <Placeholder title={`${planned.label} — coming soon`} note={planned.site} />
    );
  }

  const problem = embed.check(call.attributes);
  if (problem !== null) return <Placeholder title={`${call.name}: ${problem}`} detail={source} />;

  const { Render } = renderer;
  return <Render attributes={call.attributes} data={await loadEmbed(call.name, call.attributes)} />;
}

function Placeholder({ title, detail, note }: { title: string; detail?: string; note?: string }) {
  return (
    <div className="my-5 rounded-lg border border-dashed border-ink-300 px-4 py-3 text-sm not-italic dark:border-ink-700">
      <p className="font-medium text-ink-700 dark:text-ink-300">{title}</p>
      {note !== undefined && (
        <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{note}</p>
      )}
      {detail !== undefined && (
        <p className="mt-0.5 font-mono text-xs break-all text-ink-500 dark:text-ink-400">
          {detail}
        </p>
      )}
    </div>
  );
}
