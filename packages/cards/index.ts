// packages/cards — the one place that reads `data/cards/` off disk.
//
// It exists because `core` does no file I/O and `web` cannot import `jobs`
// (§5, §8). Everything here is a loader; the lookups themselves are
// `core/legality/build-card-index`, which takes the dataset as an argument.

export * from "./dataset/index";
