# @ps/contracts

Types only. **Zero runtime dependencies, and zero emitted runtime code** — no
`enum`, no exported `const`, no class, no function body. That is what lets both
sides of an interface be built in parallel by different people (§5).

## Stability

**Changing an exported type here is a breaking change.** It must be called out
in the PR description, with the list of changed types and who has to react.
Everything in the workspace builds against this package; a rename that looks
free here costs a rebuild everywhere else.

Adding a new optional field, or a new type, is not breaking. Making an optional
field required, removing a field, narrowing a union, or renaming anything is.

## Conventions

- TypeScript is camelCase; Postgres is snake_case. These types map **1:1 onto
  the columns in Part IV of the master plan**; `packages/db` repositories do the
  translation. A type that mirrors a table says so, and column-for-column
  fidelity is a review item.
- Postgres enums are reproduced as string-literal unions with exactly the same
  members and spellings.
- `foo?: T` means the field may be **absent**. `foo: T | null` means it is
  present and may be null. `exactOptionalPropertyTypes` is on, so the two are
  not interchangeable — pick the one the source data actually does.
- Collections are `readonly`. Lookup structures are `ReadonlyMap` / `ReadonlySet`
  so a check is a lookup, not a scan.

## Modules

`primitives` is not one of the eight domain modules in §7. It exists so `IsoDate`
has one definition rather than four, and so no domain module has to own a scalar
only its neighbours need.

| Module | Exports |
|---|---|
| `primitives` | `IsoDate` · `IsoDateTime` · `JsonValue` |
| `cards` | `OracleId` · `SetCode` · `Rarity` · `Color` · `Layout` · `CardFace` · `OracleCard` · `CardImageUris` · `CardPrinting` · `CardDatasetAttribution` · `CardDatasetMeta` · `CardDataset` · `CardIndexEntry` · `CardIndex` |
| `decks` | `DeckId` · `DeckVisibility` · `Board` · `WinLossDraw` · `ParsedLine` · `DeckParseIssueCode` · `DeckParseIssue` · `ParsedDeck` · `ResolvedCard` · `ResolutionCandidate` · `ResolvedDeck` · `DecklistFilenameMeta` |
| `format` | `FormatVersionId` · `FormatVersion` · `CardRuling` · `FormatCardRule` · `DeckConstraints` · `FormatRules` · `CardIssue` · `DeckIssue` · `Issue` · `IssueCode` · `LegalityVerdict` |
| `results` | `AdapterId` · `SeasonId` · `TournamentId` · `MatchId` · `Capability` · `TournamentStatus` · `ImportStatus` · `MatchResult` · `RawRow` · `ParseIssueSeverity` · `ParseIssue` · `ColumnRef` · `MappableField` · `ColumnMapping` · `RawInput` · `ParsedMatch` · `ParsedStanding` · `ParsedRosterEntry` · `ParsedDecklistEntry` · `ParsedEvent` · `ResultsAdapter` · `AdapterDetection` |
| `identity` | `IdentityId` · `PlayerId` · `MergeSuggestionId` · `PlayerVisibility` · `IdentityPlatform` · `IdentitySource` · `Handle` · `IdentityRef` · `Signal` · `ExclusionReason` · `Exclusion` · `MergeCandidate` · `MergeSuggestionStatus` · `MergeSuggestion` |
| `ratings` | `RatingConfig` · `LedgerMatch` · `RatingEvent` · `PlayerRating` · `RatingAnomalyKind` · `SelfPlayAnomaly` · `DuplicateMatchAnomaly` · `ImpossibleGameCountAnomaly` · `RatingJumpAnomaly` · `RatingAnomaly` · `ReplayResult` |
| `metrics` | `ArchetypeId` · `ArchetypeSupertype` · `MvBucket` · `MvBuckets` · `ColorCountKey` · `ColorCounts` · `CardTypeBucket` · `TypeCounts` · `SetCounts` · `MetricRarity` · `RarityCounts` · `DeckMetrics` · `DeckVector` · `SimilarityEdge` · `LayoutPoint` · `EventSeriesPoint` · `EventSeries` · `CardEventStats` · `ArchetypeEventStats` · `ArchetypeShare` · `StatsBoard` · `CardStats` · `ArchetypeStats` · `MatchupStats` · `WilsonInterval` · `SuppressionLevel` · `SuppressionVerdict` |
| `content` | `ProfileId` · `PostId` · `PostRevisionId` · `UserRole` · `Profile` · `PostStatus` · `Post` · `PostRevision` · `InfoPageComponent` · `InfoPageFrontmatter` · `RedditConversionInput` |

## Who owns what

An id is declared once, by the module that owns the concept, and imported
everywhere else. The graph is acyclic:

```
primitives ← cards, content, results, format, identity, ratings, metrics
cards      ← decks, format, metrics
decks      ← format, metrics
content    ← identity                 (ProfileId, UserRole)
results    ← identity, ratings, metrics   (SeasonId, TournamentId, MatchId, MatchResult)
identity   ← ratings                  (PlayerId)
```

## The four load-bearing decisions visible in these types

- **`OracleId` is branded.** `oracle_id` columns carry no foreign key (ADR 002),
  so the type system is the only place a deck id can be caught standing in for
  an oracle id. Construct one with a cast, at the boundary, once.
- **`LedgerMatch` names players, `ParsedMatch` names handles.** The ledger
  records handles, not people (ADR 003); resolution happens at read time, in the
  repository layer. The replay boundary is visible in the two types.
- **`ParsedEvent`'s payloads are optional.** A standings-only source returns
  standings and nothing else. An empty `matches: []` would read as "this event
  had no pairings", which is how ratings get silently corrupted (ADR 006).
- **`Signal.kind` is an open string.** Adding a sixth identity signal is one new
  file under `core/identity/signals/` and no edit here (§8.6). A closed union
  would make every new signal a breaking change.

## Tests

`<module>.test.ts` next to each module pins the acceptance criteria as
**compile-time** assertions: a realistic literal `satisfies` the type, so a
renamed field or a field that quietly became required fails to compile rather
than failing a runtime expectation.

```bash
pnpm --filter contracts test
```
