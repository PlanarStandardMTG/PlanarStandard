import { describe, expectTypeOf, it } from "vitest";
import type {
  CardDataset,
  CardDatasetMeta,
  CardFace,
  CardIndex,
  CardPrinting,
  Layout,
  OracleCard,
  OracleId,
} from "./cards";

const llanowarElves = "0e606072-a3aa-4300-ad14-ef9c1bd6a83b" as OracleId;
const feedTheSwarm = "2c1b1e19-e0f4-4c6a-b9f9-dd9e2b0d8d0f" as OracleId;
const bloomvineRegent = "5b9b5e9f-1b5a-4a1e-9a0c-9d4c2f1d7a11" as OracleId;
const delverOfSecrets = "c0d20f3c-ba41-4f13-a4c8-4d0e2c9cd4b3" as OracleId;

const elves = {
  oracleId: llanowarElves,
  name: "Llanowar Elves",
  manaCost: "{G}",
  manaValue: 1,
  colorIdentity: ["G"],
  typeLine: "Creature — Elf Druid",
  oracleText: "{T}: Add {G}.",
  layout: "normal",
  setCodes: ["fdn"],
} satisfies OracleCard;

const elvesInFoundations = {
  oracleId: llanowarElves,
  setCode: "fdn",
  collectorNumber: "227",
  rarity: "common",
  imageUris: {
    small: "https://cards.scryfall.io/small/front/0/e/0e606072.jpg",
    normal: "https://cards.scryfall.io/normal/front/0/e/0e606072.jpg",
    artCrop: "https://cards.scryfall.io/art_crop/front/0/e/0e606072.jpg",
  },
  promo: false,
  digital: false,
} satisfies CardPrinting;

describe("cards contracts", () => {
  it("brands oracle ids so a bare string cannot stand in for one", () => {
    expectTypeOf<OracleId>().toExtend<string>();
    expectTypeOf<string>().not.toExtend<OracleId>();
  });

  it("carries only the fields the app uses", () => {
    expectTypeOf<keyof OracleCard>().toEqualTypeOf<
      | "oracleId"
      | "name"
      | "manaCost"
      | "manaValue"
      | "colorIdentity"
      | "typeLine"
      | "oracleText"
      | "layout"
      | "faces"
      | "setCodes"
    >();
  });

  it("drops the Scryfall fields the build job prunes", () => {
    expectTypeOf<
      | "rulings_uri"
      | "prices"
      | "foreign_names"
      | "purchase_uris"
      | "legalities"
      | "edhrec_rank"
    >().not.toExtend<keyof OracleCard>();
  });

  it("represents a single-face card from the pool", () => {
    expectTypeOf(elves).toExtend<OracleCard>();
    expectTypeOf(elves).not.toHaveProperty("faces");
  });

  it("gives the metrics modules mana value, colour identity and a type line", () => {
    expectTypeOf(elves.manaValue).toEqualTypeOf<number>();
    expectTypeOf(elves.colorIdentity).toExtend<readonly string[]>();
    expectTypeOf(elves.typeLine).toEqualTypeOf<string>();
  });

  it("takes rarity, set and images from the printing, not the oracle card", () => {
    expectTypeOf(elvesInFoundations).toExtend<CardPrinting>();
    expectTypeOf<"rarity" | "setCode" | "imageUris">().not.toExtend<
      keyof OracleCard
    >();
  });

  it("decides legality from the sets the oracle card is printed in", () => {
    // `Llanowar Elves (M19)` on a decklist is provenance only: M19 is outside the fetch
    // scope, so the card's sole dataset set is FDN, and that is what it counts as.
    expectTypeOf(elves.setCodes).toExtend<readonly string[]>();
    const outsideThePool = { ...elves, setCodes: [] } satisfies OracleCard;
    expectTypeOf(outsideThePool.setCodes).toExtend<readonly string[]>();
  });

  it("keeps alphanumeric collector numbers and marks promo printings", () => {
    const promoPrinting = {
      oracleId: feedTheSwarm,
      setCode: "psos",
      collectorNumber: "25p",
      rarity: "uncommon",
      imageUris: null,
      promo: true,
      digital: false,
    } satisfies CardPrinting;
    expectTypeOf(promoPrinting).toExtend<CardPrinting>();
    expectTypeOf(promoPrinting.collectorNumber).toEqualTypeOf<string>();
  });

  it("represents a split card as faces", () => {
    const face = {
      name: "Claim Territory",
      manaCost: "{1}{G}",
      manaValue: 2,
      typeLine: "Sorcery — Omen",
      oracleText: "Search your library for a basic land card.",
    } satisfies CardFace;
    const split = {
      oracleId: bloomvineRegent,
      name: "Bloomvine Regent // Claim Territory",
      manaCost: "{3}{R}{G} // {1}{G}",
      manaValue: 5,
      colorIdentity: ["R", "G"],
      typeLine: "Creature — Dragon // Sorcery — Omen",
      oracleText: null,
      layout: "split",
      faces: [
        {
          name: "Bloomvine Regent",
          manaCost: "{3}{R}{G}",
          manaValue: 5,
          typeLine: "Creature — Dragon",
          oracleText: "Flying",
        },
        face,
      ],
      setCodes: ["tdm"],
    } satisfies OracleCard;
    expectTypeOf(split).toExtend<OracleCard>();
    expectTypeOf(split.faces).toExtend<readonly CardFace[]>();
  });

  it("puts the cost on the faces when the layout has no cost of its own", () => {
    // Shape fixture: a transform card's back face has no mana cost, so neither does the card.
    const transform = {
      oracleId: delverOfSecrets,
      name: "Delver of Secrets // Insectile Aberration",
      manaCost: null,
      manaValue: 1,
      colorIdentity: ["U"],
      typeLine: "Creature — Human Wizard // Creature — Human Insect",
      oracleText: null,
      layout: "transform",
      faces: [
        {
          name: "Delver of Secrets",
          manaCost: "{U}",
          manaValue: 1,
          typeLine: "Creature — Human Wizard",
          oracleText:
            "At the beginning of your upkeep, look at the top card of your library.",
        },
        {
          name: "Insectile Aberration",
          manaCost: null,
          manaValue: null,
          typeLine: "Creature — Human Insect",
          oracleText: "Flying",
        },
      ],
      setCodes: ["ecl"],
    } satisfies OracleCard;
    expectTypeOf(transform).toExtend<OracleCard>();
    expectTypeOf<OracleCard["manaCost"]>().toEqualTypeOf<string | null>();
    expectTypeOf<CardFace["manaValue"]>().toEqualTypeOf<number | null>();
  });

  it("images each face separately when the layout needs it", () => {
    const doubleFaced = {
      oracleId: delverOfSecrets,
      setCode: "ecl",
      collectorNumber: "51",
      rarity: "rare",
      imageUris: null,
      faceImageUris: [
        {
          small: "https://cards.scryfall.io/small/front/c/0/c0d20f3c.jpg",
          normal: "https://cards.scryfall.io/normal/front/c/0/c0d20f3c.jpg",
          artCrop: "https://cards.scryfall.io/art_crop/front/c/0/c0d20f3c.jpg",
        },
        {
          small: "https://cards.scryfall.io/small/back/c/0/c0d20f3c.jpg",
          normal: "https://cards.scryfall.io/normal/back/c/0/c0d20f3c.jpg",
          artCrop: "https://cards.scryfall.io/art_crop/back/c/0/c0d20f3c.jpg",
        },
      ],
      promo: false,
      digital: false,
    } satisfies CardPrinting;
    expectTypeOf(doubleFaced).toExtend<CardPrinting>();
  });

  it("covers the layouts the parser and the pool actually produce", () => {
    expectTypeOf<
      | "normal"
      | "split"
      | "modal_dfc"
      | "transform"
      | "adventure"
      | "saga"
      | "battle"
    >().toExtend<Layout>();
    expectTypeOf<"token" | "emblem" | "art_series">().not.toExtend<Layout>();
  });

  it("indexes by oracle id, by normalized name, and by set", () => {
    const index = {
      byOracleId: new Map([
        [llanowarElves, { card: elves, printings: [elvesInFoundations] }],
      ]),
      byNormalizedName: new Map([["llanowarelves", [llanowarElves]]]),
      bySet: new Map([["fdn", [llanowarElves]]]),
    } satisfies CardIndex;
    expectTypeOf(index).toExtend<CardIndex>();
    expectTypeOf(index.byOracleId.get(llanowarElves)?.printings).toExtend<
      readonly CardPrinting[] | undefined
    >();
  });

  it("lets one normalized name reach more than one oracle card", () => {
    const collision = new Map([
      ["claimterritory", [bloomvineRegent, feedTheSwarm]],
    ]) satisfies CardIndex["byNormalizedName"];
    expectTypeOf(collision.get("claimterritory")).toExtend<
      readonly OracleId[] | undefined
    >();
  });

  it("describes the three files the build job emits", () => {
    const meta = {
      bulkUpdatedAt: "2026-09-08T09:12:33.000Z",
      setCodes: ["sos", "ecl", "eoe", "tdm", "dft", "fdn"],
      oracleCardCount: 2184,
      printingCount: 3127,
      printingCountBySet: {
        sos: 291,
        ecl: 286,
        eoe: 290,
        tdm: 287,
        dft: 276,
        fdn: 1697,
      },
      generatedAt: "2026-09-14",
      attribution: {
        source: "Scryfall",
        sourceUrl: "https://scryfall.com",
        notice:
          "Card data from Scryfall. Magic: The Gathering is © Wizards of the Coast.",
      },
    } satisfies CardDatasetMeta;
    const dataset = {
      oracle: [elves],
      printings: [elvesInFoundations],
      meta,
    } satisfies CardDataset;
    expectTypeOf(dataset).toExtend<CardDataset>();
    expectTypeOf(dataset.meta.attribution.source).toEqualTypeOf<"Scryfall">();
  });
});
