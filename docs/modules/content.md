# Content: writing, components, and exports

How an article is written, what it may contain, and how it leaves the site.
Who may publish is in [`auth.md`](auth.md#posts-who-publishes).

## Writing

`/dashboard/community/new` (`?kind=official` for a news post, admins only) and
`/dashboard/community/[id]/edit` (E20.2). Every feed has a button into it. The body
is Markdown in a textarea (ADR 001: Reddit is Markdown, so the post is too),
with four tabs:

| Tab     | What it shows                                                                     |
| ------- | --------------------------------------------------------------------------------- |
| Write   | the Markdown, a small toolbar, and the components panel                           |
| Preview | `PostArticleContent` — the published page's own component, rendered on the server |
| Reddit  | `exportPost(…, "reddit")`, with a Copy button                                     |
| Discord | `exportPost(…, "discord")`, with a Copy button and the 2,000-character count      |

The editor is a client component so a failed save keeps what was typed. Nothing
is decided in the browser: `savePost` checks with `core/content/post-draft`,
picks the status with `core/content/post-workflow`, and writes under RLS; the
preview is a server action returning rendered JSX, so a component can load its
data and the preview is the page, not an approximation of it.

A draft may be half-written. A submission must have a body, and every component
in it must exist and have valid attributes.

## Components

A component is one line alone, attributes double-quoted:

```
:::decklist{id="3f2a…" title="Rakdos Midrange"}
```

The shape `:::chart{…}` already had. Lines inside fenced code are text, so a
post can show the syntax without invoking it. **None are live yet** — decklist,
image, card and chart are listed as planned in the editor, with how each will
export, and an article that uses one can be saved but not submitted.

### Adding one

1. **`packages/core/content/embed-<name>/`** — `defineEmbed({ name, label,
description, attributes, parse, export })`, a test, and a README. `export`
   is a `Record` over every `ExportTarget`, so it does not compile without a
   Reddit and a Discord answer. Each gets the parsed attributes, whatever the
   site loaded (or null), and the site origin.
2. **`packages/core/content/embed-catalogue`** — add it to `EMBEDS`, remove it
   from `PLANNED_EMBEDS`.
3. **`apps/web/components/content/embeds/renderers.tsx`** — an `EmbedRenderer`
   under the same name: `Render`, and `load` if it needs data. The map is typed
   by `EmbedName`, so step 2 does not compile until this exists, and
   `renderers.test.ts` checks both directions.

That is all: the editor lists it with an Insert button, `PostBody` renders it,
submission validates it, and both exports expand it.

### Exporting data-backed components

`load` runs on the server with the viewer's session, so a decklist can read the
author's own private decks through RLS. What it returns reaches `Render` and the
component's `export` functions alike — which is how a decklist becomes a link
and then the list as text on Reddit. If loading fails or returns null, the
export must still produce something, usually a link back to the site.

Images have no answer yet beyond a link: a Reddit self-post cannot inline one,
and Discord unfurls a bare URL. Where uploads are stored is undecided.

## Exporting a post

`core/content/export-post` expands components first (each through its own
export), then runs the platform pipeline over the result: `reddit/to-reddit-markdown`
for Reddit; for Discord, tables to lists, HTML stripped, images to links,
headings capped at three levels, links absolutised, and a cut at a paragraph so
the message fits in 2,000 characters with the link to the full post kept.

Adding a target means adding it to `ExportTarget` — every component then fails
to compile until it answers for it.

## Modules

| Module                                    | Job                                                |
| ----------------------------------------- | -------------------------------------------------- |
| `core/content/embed-syntax`               | find and rewrite `:::name{…}` lines                |
| `core/content/embed-registry`             | what a component is; `expandEmbeds`                |
| `core/content/embed-catalogue`            | the live components, and the planned ones          |
| `core/content/export-post`                | a body for Reddit or Discord                       |
| `core/content/post-draft`                 | whether input can be saved or submitted; the slug  |
| `core/content/post-workflow`              | which status a submission, save or review lands in |
| `web/components/content/post-editor`      | the editor                                         |
| `web/components/content/embeds/`          | renderers, loading, and how a line becomes a block |
| `web/app/dashboard/community/actions.tsx` | `savePost`, `previewPost`                          |
