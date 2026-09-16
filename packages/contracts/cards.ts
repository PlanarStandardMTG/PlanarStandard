// The shape of the committed card dataset (§14.1, ADR 002). `apps/jobs/build-card-data.ts`
// prunes Scryfall's bulk file down to exactly these fields; everything else — rulings,
// prices, foreign names, purchase uris, legalities, edhrec rank — is dropped.

import type { IsoDateTime } from "./primitives";

declare const oracleIdBrand: unique symbol;

/** A Scryfall oracle id. Branded because `oracle_id` columns carry no foreign key (ADR 002). */
export type OracleId = string & { readonly [oracleIdBrand]: "OracleId" };

/**
 * A Scryfall set code, lowercase as Scryfall emits it. Decklists and admin input write
 * `(TDM)`; lowercase before any lookup keyed by this.
 */
export type SetCode = string;

export type Rarity =
  "common" | "uncommon" | "rare" | "mythic" | "special" | "bonus";

/** Colour identity letters, as Scryfall writes them. */
export type Color = "W" | "U" | "B" | "R" | "G";

/**
 * Scryfall layouts for ordinary cards. Tokens, emblems, art series and the
 * Planechase/Vanguard layouts live in sets the fetch scope never includes.
 *
 * `reversible_card` is in scope but never emitted: those rows carry no top-level
 * `oracle_id`, and every one of them is an alternate printing of a card the pool
 * already reaches. The prune drops them and asserts that. See `build-card-data/prune`.
 */
export type Layout =
  | "normal"
  | "split"
  | "flip"
  | "transform"
  | "modal_dfc"
  | "meld"
  | "leveler"
  | "class"
  | "case"
  | "saga"
  | "adventure"
  /** Secrets of Strixhaven's split-like layout: two faces, one image, a joined cost. */
  | "prepare"
  | "mutate"
  | "prototype"
  | "battle"
  | "reversible_card";

/** One face of a multi-face card. `Bloomvine Regent // Claim Territory` is two faces. */
export type CardFace = {
  readonly name: string;
  readonly manaCost: string | null;
  /** null where the face has no cost of its own, such as a transform back. */
  readonly manaValue: number | null;
  readonly typeLine: string;
  readonly oracleText: string | null;
};

export type OracleCard = {
  readonly oracleId: OracleId;
  /** The full Scryfall name, `//`-joined on multi-face cards. */
  readonly name: string;
  /** null on layouts that carry the cost per face, such as transform and modal_dfc. */
  readonly manaCost: string | null;
  readonly manaValue: number;
  readonly colorIdentity: readonly Color[];
  readonly typeLine: string;
  readonly oracleText: string | null;
  readonly layout: Layout;
  /** Present only on multi-face layouts. */
  readonly faces?: readonly CardFace[];
  /**
   * Every set in the dataset this oracle card has a printing in. Legality reads this
   * and never the printings array (ADR 007).
   */
  readonly setCodes: readonly SetCode[];
};

/** Hotlinked from Scryfall, never derived or cached — their terms. Grid, card view, art tile. */
export type CardImageUris = {
  readonly small: string;
  readonly normal: string;
  readonly artCrop: string;
};

/** One row of `data/cards/printings.json`. */
export type CardPrinting = {
  readonly oracleId: OracleId;
  readonly setCode: SetCode;
  /** Alphanumeric in the wild: `25p`, `WOE-273`. */
  readonly collectorNumber: string;
  readonly rarity: Rarity;
  /** null when the layout images each face separately — see `faceImageUris`. */
  readonly imageUris: CardImageUris | null;
  /** Front face first, present only when the printing images its faces separately. */
  readonly faceImageUris?: readonly CardImageUris[];
  /** Both feed `set-attribution`'s tiebreak when a card is legal through two sets. */
  readonly promo: boolean;
  readonly digital: boolean;
};

/** Scryfall's terms require the data to carry credit wherever it is used. */
export type CardDatasetAttribution = {
  readonly source: "Scryfall";
  readonly sourceUrl: string;
  readonly notice: string;
};

/** `data/cards/meta.json`. */
export type CardDatasetMeta = {
  /** `updated_at` of the bulk file this was pruned from. */
  readonly bulkUpdatedAt: IsoDateTime;
  /** The fetch scope at build time — `data/sets.json`, not the legal pool (§14.1). */
  readonly setCodes: readonly SetCode[];
  readonly oracleCardCount: number;
  readonly printingCount: number;
  /** Per set, so a rebuild's PR body can diff two runs. */
  readonly printingCountBySet: Readonly<Record<SetCode, number>>;
  /** When the job ran. */
  readonly generatedAt: IsoDateTime;
  readonly attribution: CardDatasetAttribution;
};

/** The three files under `data/cards/`, loaded. Arrays are emitted sorted so diffs stay readable. */
export type CardDataset = {
  readonly oracle: readonly OracleCard[];
  readonly printings: readonly CardPrinting[];
  readonly meta: CardDatasetMeta;
};

/** An oracle card with the printings the dataset carries for it. */
export type CardIndexEntry = {
  readonly card: OracleCard;
  readonly printings: readonly CardPrinting[];
};

export type CardIndex = {
  readonly byOracleId: ReadonlyMap<OracleId, CardIndexEntry>;
  /**
   * Keyed by `normalize-name` output, individual faces included, so one key can reach
   * more than one card — a front-face name can equal another card's whole name.
   */
  readonly byNormalizedName: ReadonlyMap<string, readonly OracleId[]>;
  readonly bySet: ReadonlyMap<SetCode, readonly OracleId[]>;
};
