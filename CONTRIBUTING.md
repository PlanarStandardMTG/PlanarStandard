# Contributing

The promise this repo makes: **you are productive in five minutes with no
secrets.** The interesting logic — parsing, legality, metrics, Elo, identity
matching — is pure, takes its data as arguments, and tests with nothing but
`pnpm test`.

## The zero-credential path

```bash
pnpm install                     # Node >= 24, pnpm 12
pnpm --filter core test          # no env vars, no Docker, no account
pnpm --filter adapters test      # same
```

That is the whole setup for `contracts`, `core`, and `adapters`, which is where
most of the open work lives. Card data is committed to the repo (`data/cards/`),
so even legality and metrics work offline on a fresh clone.

Before you push, run what CI runs, in this order:

```bash
pnpm lint
pnpm depcruise
pnpm guard:server-only
pnpm test
pnpm build
```

## Starting a module

```bash
pnpm new:module core/metrics/mana-curve
```

That writes `index.ts`, `index.test.ts`, and `README.md`. **The generated test
fails on purpose** — make it pass by writing the module, not by deleting the test.

A module is one directory, one responsibility, one test file. If you can't
describe it in a sentence without "and", it is two modules.

## Fixtures

Parser and adapter work is fixture-driven. A new edge case is **a fixture plus a
branch** — which is the smallest useful pull request in this repo, and the
reason the corpus is a better on-ramp than the code.

`fixtures/README.md` has the layout, the naming rule, and a table of every
pathology already covered. Read it before adding one.

## The dependency rule

```
contracts <- core <- adapters
    ^         ^          ^
    └──── db ─┴──────────┘
              ^
         web, jobs
```

Dependencies point left only. `pnpm depcruise` fails a PR that breaks this
before a human reads it. In particular `packages/core` never imports `db`,
`next`, `react`, or `@supabase/*` — if a function needs data, it takes it as an
argument. If the boundary feels wrong, the design is wrong; open an issue rather
than routing around it.

## Good first issues, by shape

Each of these is a self-contained PR with no coordination:

| Shape                  | What it takes                                                  |
| ---------------------- | -------------------------------------------------------------- |
| A new source adapter   | a real export in `fixtures/`, `detect`, `parse`, expected JSON |
| A new identity signal  | one scoring function in `core/identity/signals/`               |
| A new Reddit transform | one before/after fixture pair                                  |
| A decklist edge case   | one fixture and one branch                                     |
| A chart                | a pure component and a Storybook story                         |
| An MDX info page       | no code at all                                                 |

## Definition of done

Every PR, from §19 of the master plan:

- [ ] One module, one responsibility. Describable in a sentence with no "and".
- [ ] `README.md` in the module directory: purpose, inputs, outputs, gotchas.
- [ ] Tests covering the happy path plus every known edge case, using `fixtures/` where real data exists.
- [ ] Pure modules import nothing from `db`, `next`, `react`, or `@supabase/*`.
- [ ] No new dependency without a line in the PR description explaining why.
- [ ] Any user-visible rate or percentage goes through `suppress-small-n` and shows `n`.
- [ ] Any changed metric definition is reflected in `content/pages/methodology.mdx`.
- [ ] `pnpm lint && pnpm test && pnpm depcruise` pass.

Changing an exported type in `packages/contracts` is a breaking change and must
be called out in the PR description.

## Where decisions live

`docs/adr/` — fourteen of them, one short file each. Check there before
reopening a settled question; the format rules, the handles-not-people ledger,
and the card-data-as-artifact decision all have one.

`planar-standard-master-plan.md` is the design and `backlog.md` is the work,
sized so each story fits one sitting. Branch names and PR titles use the story
ID: `E5.2`, `E12.4`.

## The full stack

Only the Discord webhook needs a real secret. Sign-in does not: local Supabase
takes an email and a password, and Mailpit at <http://127.0.0.1:54324> catches
the confirmation and magic links it sends. Everything else runs locally:

```bash
pnpm db:start                    # supabase start (local Docker)
pnpm db:reset                    # migrations + seed
pnpm dev                         # http://localhost:3000
```

The seed ships an anonymised derivative of a real season, so the site comes up
populated. Nobody can meaningfully improve a chart against an empty database.
