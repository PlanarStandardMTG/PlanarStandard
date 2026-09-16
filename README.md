# Planar Standard Hub

A community site for the Magic: The Gathering format Planar Standard.
Full context lives in `docs/` once copied in — see `planar-standard-master-plan.md`
and `backlog.md` for the plan this scaffold implements (start at epic **E1**).

## Quick start (no credentials needed)

```bash
pnpm install
pnpm --filter @ps/core test         # works immediately, zero setup
pnpm --filter @ps/adapters test     # works immediately, zero setup
```

## Full stack (needs Docker)

```bash
pnpm db:start                       # supabase start (local Docker)
pnpm db:reset                       # migrations + seed
pnpm dev                            # http://localhost:3000
```

Only the Discord webhook needs a real secret. Sign-in does not — local
Supabase takes an email and a password and catches its own mail — and neither
does anything else, including legality and metrics.

## Layout

```
packages/
├── contracts/   types only, zero runtime dependencies
├── core/        pure functions, depends on contracts ONLY
├── adapters/    source parsers, depends on contracts + core
└── db/          schema, migrations, repositories
apps/
├── web/         Next.js app (scaffolded in E16)
└── jobs/        scheduled scripts, run by GitHub Actions
data/            data/sets.json (PR-reviewed) + data/cards/ (generated, E4)
content/pages/   MDX info pages
fixtures/        shared test fixtures
docs/adr/        architecture decision records
docs/modules/    one page per module
```

Dependencies point left only, enforced by `pnpm depcruise` — see
`.dependency-cruiser.cjs`.

## Status

This is the E1.1 workspace skeleton: empty packages that install, build, and
test cleanly. Next up per the backlog: E1.2–E1.9 (strict TS config already
included, project references, lint, CI already wired — remaining: module
scaffold generator, fixtures conventions), then E2 (contracts).
