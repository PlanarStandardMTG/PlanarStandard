import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import { DEV_ACCOUNTS, DEV_PASSWORD, devAccountSwitcherEnabled } from "./dev-accounts";

const seed = readFileSync(
  new URL("../../../../packages/db/seed/0001_profiles.sql", import.meta.url),
  "utf8",
);

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("DEV_ACCOUNTS", () => {
  it("names only accounts the seed creates, with the seed's password", () => {
    expect(seed).toContain(`crypt('${DEV_PASSWORD}'`);
    for (const account of DEV_ACCOUNTS) {
      expect(seed).toContain(`'${account.email}'`);
    }
  });

  it("covers every account the seed creates", () => {
    const seeded = seed.match(/'[a-z]+@planarstandard\.test'/g) ?? [];
    expect(DEV_ACCOUNTS).toHaveLength(seeded.length);
  });

  it("has every role on the ladder", () => {
    expect(new Set(DEV_ACCOUNTS.map((a) => a.role))).toEqual(
      new Set(["reader", "writer", "organizer", "admin"]),
    );
  });
});

describe("devAccountSwitcherEnabled", () => {
  it("is on under next dev", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(devAccountSwitcherEnabled()).toBe(true);
  });

  it.each(["production", "test"])("is off under %s", (env) => {
    vi.stubEnv("NODE_ENV", env);
    expect(devAccountSwitcherEnabled()).toBe(false);
  });
});
