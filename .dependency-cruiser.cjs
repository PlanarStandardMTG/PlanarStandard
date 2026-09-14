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
      from: {},
      to: { circular: true },
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
        path: "^packages/(adapters|db)|^apps|^node_modules/(next|react|react-dom|@supabase)",
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
      name: "db-depends-on-contracts-only",
      severity: "error",
      comment: "packages/db depends on contracts only.",
      from: { path: "^packages/db" },
      to: { path: "^packages/(core|adapters)|^apps" },
    },
  ],
  options: {
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.base.json" },
    enhancedResolveOptions: { exportsFields: ["exports"], conditionNames: ["import", "require", "node", "default"] },
    reporterOptions: {
      err: { showMetrics: false },
    },
  },
};
