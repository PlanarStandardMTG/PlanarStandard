// packages/db — schema, migrations, repositories.
//
// `migrations/` is numbered and forward-only; `seed/` is loaded by
// `pnpm db:reset`. Repositories expose narrow, intention-revealing functions —
// never a generic query builder (§10).

export * from "./repos/profiles/index";
export * from "./repos/content/index";
export * from "./repos/format/index";
export * from "./repos/events/index";
export * from "./repos/decks/index";
export * from "./repos/archetypes/index";
export * from "./repos/tournaments/index";
export * from "./repos/results/index";
export * from "./repos/ratings/index";
export * from "./repos/identity/index";
