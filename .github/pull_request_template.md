<!-- Title: start with the backlog story ID, e.g. "E5.2 — resolve-card-name" -->

## What this does

<!-- One or two sentences. If you need an "and", this may be two PRs. -->

## Definition of done

From §19 of `planar-standard-master-plan.md`. Tick every box or say why it does not apply.

- [ ] One module, one responsibility. Describable in a sentence with no "and".
- [ ] `README.md` in the module directory: purpose, inputs, outputs, gotchas.
- [ ] Tests covering the happy path plus every known edge case, using `fixtures/` where real data exists.
- [ ] Pure modules import nothing from `db`, `next`, `react`, or `@supabase/*`.
- [ ] No new dependency without a line in the PR description explaining why.
- [ ] Any user-visible rate or percentage goes through `suppress-small-n` and shows `n`.
- [ ] Any changed metric definition is reflected in `content/pages/methodology.mdx`.
- [ ] `pnpm lint && pnpm test && pnpm depcruise` pass.

## Breaking changes

- [ ] This PR changes an exported type in `packages/contracts`.

<!-- If ticked, list the changed types and who has to react. That is what makes
     the contracts package safe to build against in parallel. -->

## New dependencies

<!-- One line each: what it is, and why nothing already here does the job.
     Only `mana-font` and `keyrune` are pre-approved from the MTG ecosystem (ADR 014). -->
