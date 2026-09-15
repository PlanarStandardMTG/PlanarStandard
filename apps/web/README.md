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
every feed and article page shares; `lib/` holds helpers and the two Supabase
clients. Feature slices (§11, E20) will move route-owned code out of
`components/content` as they land.

**Gotchas.**

- Data pages are `force-dynamic`. Posts are published from the site rather than
  from a deploy, so nothing content-backed may be baked at build time — and it is
  what lets CI build the app with no database and no environment.
- A `loading.tsx` wraps its segment **and its children**. Feed indexes therefore
  sit in an `(index)` route group, so their skeleton cannot reach `[slug]`: once
  a loading boundary flushes the response shell, the status is committed as 200
  and a later `notFound()` renders the not-found body under a 200.
- `lib/supabase/server.ts` uses the anon key and is subject to RLS. Anything that
  needs to write, or to read past a policy, uses `service-role.server.ts` — and
  the `.server.ts` suffix is what `pnpm guard:server-only` keys on.
