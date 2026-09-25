import type { CardIndexEntry, CardPrinting, OracleCard, OracleId } from "@ps/contracts";
import { describe, expect, it } from "vitest";

import { frontImage, pickPrinting } from "./index";

const ID = "o-1" as OracleId;
const image = (tag: string) => ({ small: `${tag}-s`, normal: `${tag}-n`, artCrop: `${tag}-a` });

function printing(overrides: Partial<CardPrinting>): CardPrinting {
  return {
    oracleId: ID,
    setCode: "fdn",
    collectorNumber: "1",
    rarity: "common",
    imageUris: image("fdn-1"),
    promo: false,
    digital: false,
    ...overrides,
  };
}

const entry = (printings: CardPrinting[]): CardIndexEntry => ({
  card: { oracleId: ID, name: "Card" } as OracleCard,
  printings,
});

describe("core/decklist/pick-printing", () => {
  const promo = printing({
    setCode: "pfdn",
    collectorNumber: "1p",
    promo: true,
    imageUris: image("promo"),
  });
  const plain = printing({ setCode: "dft", collectorNumber: "9", imageUris: image("dft") });
  const other = printing({ setCode: "fdn", collectorNumber: "300", imageUris: image("fdn") });

  it("shows the printing the list named, whatever its case", () => {
    expect(pickPrinting(entry([promo, plain, other]), { set: "FDN", collector: "300" })).toBe(
      other,
    );
  });

  it("falls back to the first paper, non-promo printing with an image", () => {
    expect(pickPrinting(entry([promo, plain, other]))).toBe(plain);
    expect(pickPrinting(entry([promo, plain, other]), { set: "PLST", collector: "WOE-273" })).toBe(
      plain,
    );
  });

  it("uses the front face's image for a two-faced card", () => {
    const dfc = printing({ imageUris: null, faceImageUris: [image("front"), image("back")] });
    expect(frontImage(dfc)?.normal).toBe("front-n");
  });

  it("returns null for a card with no printings", () => {
    expect(pickPrinting(entry([]))).toBeNull();
  });
});
