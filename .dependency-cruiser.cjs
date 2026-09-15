/**
 * Enforces §5 of the master plan:
 *   contracts <- core <- adapters
 *       ^         ^          ^
 *       └──── db ─┴──────────┘
 *                 ^
 *            web, jobs
 *
 * Dependencies point left only. No cycles. Ever.
 */
module.exports = {
  forbidden: [
    {
      name: "no-cycles",
      severity: "error",
      comment: "Dependencies point left only. No cycles.",
      // Our own code only: a dependency's internal cycles are not our rule to
      // enforce and not our bug to fix.
      from: { pathNot: "(^|/)node_modules/" },
      to: { circular: true, pathNot: "(^|/)node_modules/" },
    },
    {
      name: "contracts-is-a-leaf",
      severity: "error",
      comment:
        "packages/contracts has no runtime dependencies at all, so both sides of any interface can be built in parallel.",
      from: { path: "^packages/contracts" },
      to: { path: "^packages/(core|adapters|db)|^apps" },
    },
    {
      name: "core-is-pure",
      severity: "error",
      comment:
        "packages/core must never import from db, next, react, or @supabase/*. If a function needs data, it takes it as an argument.",
      from: { path: "^packages/core" },
      to: {
        // Matched on the LAST node_modules segment: pnpm resolves `react` to
        // node_modules/.pnpm/react@19.3.0/node_modules/react/index.js, which an
        // anchored ^node_modules/react never matches.
        path: "^packages/(adapters|db)|^apps|(^|/)node_modules/(next|react|react-dom|@supabase)(/|$)",
      },
    },
    {
      name: "adapters-do-not-import-db-or-apps",
      severity: "error",
      comment: "packages/adapters depends on contracts + core only.",
      from: { path: "^packages/adapters" },
      to: { path: "^packages/db|^apps" },
    },
    {
      name: "server-only-stays-out-of-packages",
      severity: "error",
      comment:
        "E1.7 — a `*.server.ts` / `server-only/` module is where SUPABASE_SERVICE_ROLE_KEY lives. packages/ is isomorphic and must never reach one. The 'use client' half of the boundary, which depcruise cannot see, is enforced by scripts/check-server-only.ts.",
      from: { path: "^packages/" },
      to: { path: "(\\.server\\.[cm]?[jt]sx?$)|(/server-only/)" },
    },
    {
      name: "db-depends-on-contracts-only",
      severity: "error",
      comment: "packages/db depends on contracts only.",
      from: { path: "^packages/db" },
      to: { path: "^packages/(core|adapters)|^apps" },
    },
    {
      name: "no-unresolvable",
      severity: "error",
      comment:
        "An import that does not resolve. pnpm only exposes a package's declared dependencies, so this is what a boundary violation usually looks like first: `core` importing `@ps/db` cannot resolve, because `core` does not depend on it. Without this rule the cruise reports no violations and the breakage surfaces later, as a type error.",
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.depcruise.json" },
    enhancedResolveOptions: { exportsFields: ["exports"], conditionNames: ["import", "require", "node", "default"] },
    // Resolve dependencies so the rules above can see *that* a package is
    // imported, but stop at the boundary rather than walking its internals.
    // Without this, cruising `apps/web` means cruising all of Next and React and
    // running the heap out.
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(^|/)(dist|\\.next)/" },
  },
};
