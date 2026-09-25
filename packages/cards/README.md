# `@ps/cards`

The one place in `packages/` that reads a file.

Card data is a repo artifact rather than a table (§14.1, ADR 002), so something
has to load `data/cards/` off disk — and it cannot be `core`, which does no file
I/O, or `jobs`, which `web` may not import. This package is that something, and
it is deliberately nothing else: it loads, memoizes, and hands the result to
`core/legality/build-card-index`.

```
contracts ◄── core ◄── cards
```

`web` and `jobs` depend on it; nothing else does.

**Deploying.** `apps/web` reads these files at runtime, so a serverless build has
to trace them, and `next.config.ts` names `data/cards/` in
`outputFileTracingIncludes`. Inside Next a module's `import.meta.url` is a build
chunk, so the site passes its own `dir` (`apps/web/lib/cards/card-index.ts`), and
the default is built from path segments because Turbopack reads
`new URL("literal", import.meta.url)` as an asset it cannot bundle (E20.28).
