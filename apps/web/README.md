# `apps/web`

The Next.js site (E16.1). App Router, Tailwind v4, React 19.

```bash
pnpm db:start        # once, from the repo root — Docker
pnpm db:reset        # migrations + seed
cp apps/web/.env.example apps/web/.env.local
pnpm dev             # http://localhost:3000
```

**Layout.** `app/` is routes only. `components/ui/` holds primitives that know
nothing about the domain; `components/content/` holds the post components that
every feed and article page shares; `lib/` holds helpers, the two Supabase
clients, `info-pages/` — the reader, whitelist, and renderer behind
`content/pages/*.mdx` (E17), `format/`, the one read behind `<LegalSets />` and
`<Banlist />`, and `challonge/` plus `events/`, the read-through cache behind
`/events` (E23). Feature slices (§11, E20) will move route-owned code
out of `components/content` as they land.

**The two kinds of writing.** Posts are database rows, served dynamically from
`/news` and `/articles`. Info pages are MDX in the repository's `content/pages/`,
served statically from `/(info)/[...slug]` at the root of the site. Neither is a
special case of the other; §25's split rule decides which a document is.

**Gotchas.**

- Data pages are `force-dynamic`. Posts are published from the site rather than
  from a deploy, so nothing content-backed may be baked at build time — and it is
  what lets CI build the app with no database and no environment.
- A `loading.tsx` wraps its segment **and its children**. Feed indexes therefore
  sit in an `(index)` route group, so their skeleton cannot reach `[slug]`: once
  a loading boundary flushes the response shell, the status is committed as 200
  and a later `notFound()` renders the not-found body under a 200.
- Info pages are `force-dynamic` too, though their bodies are files in the
  repository: `/rules` declares `<LegalSets />` and `<Banlist />`, which read the
  `format_*` tables, and a pool or a ban baked at build time is exactly the
  staleness those rows exist to prevent. `generateStaticParams` still enumerates
  the pages, so `dynamicParams = false` makes an unpublished or unknown slug a
  404 rather than a render. The catch-all sits at the root, so it is also what
  `/nope` hits.
- `content/pages/` is read with `fs` at request time — by the footer nav on every
  route, not only by the info pages. Turbopack traces that statically, so
  `contentRoot()` is one expression rather than a search, and `next.config.ts`
  names the directory in `outputFileTracingIncludes`. A candidate-path loop there
  makes Next ship the whole repository.
- `/events` fetches from a third party during a render, on a budget of 500
  requests a month. Two things make that safe and neither is obvious from the
  page: the refresh window is **claimed before the fetch**, in one conditional
  update, so simultaneous visitors produce one request; and the interval is
  measured from the last _attempt_, so an outage costs one request per window
  rather than one per visitor. The arithmetic is in
  [`docs/modules/events.md`](../../docs/modules/events.md).
- `CHALLONGE_API_KEY` and `CHALLONGE_COMMUNITY` are production-only secrets, read
  by `lib/challonge/client.server.ts` and nothing else. Unset, the client returns
  `not-configured` and `/events` renders from the seed — which is what every
  contributor sees, and is not a broken state.
- `lib/supabase/server.ts` uses the anon key and is subject to RLS. Anything that
  needs to write, or to read past a policy, uses `service-role.server.ts` — and
  the `.server.ts` suffix is what `pnpm guard:server-only` keys on.
