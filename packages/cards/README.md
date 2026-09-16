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
to trace them. Next's file tracing does not follow a path built from
`import.meta.url`, which means `outputFileTracingIncludes` has to name
`data/cards/` explicitly (E20.4).
