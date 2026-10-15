import { afterEach, describe, expect, it, vi } from "vitest";

import { isPushConfigured, sendPush } from "./send-push.server";

/** Without the VAPID keys the play app sends nothing and reads nothing (E26.28). */
describe("lib/push/send-push", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is off until both halves of the key pair are set", () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "");
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    expect(isPushConfigured()).toBe(false);

    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "public");
    expect(isPushConfigured()).toBe(false);

    vi.stubEnv("VAPID_PRIVATE_KEY", "private");
    expect(isPushConfigured()).toBe(true);
  });

  it("sends nothing, and touches no database, when it is off", async () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "");
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    await expect(sendPush(["p1"], { title: "t", body: "b", url: "/play", tag: "x" })).resolves.toBe(
      0,
    );
  });
});
