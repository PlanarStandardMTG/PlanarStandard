import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getProfile, getProfileByHandle, updateProfile } from "./index";

/**
 * Runs against a local Supabase with the seed loaded (`pnpm db:reset`).
 *
 * Skipped rather than failed when nothing is listening, for the same reason as
 * `repos/content` and `repos/events`: `db` is the one package allowed to need
 * infrastructure, and the zero-credential promise only holds if a missing
 * instance is a skip.
 *
 * These tests create real auth users, which is the only way to exercise the
 * thing most worth exercising — the trigger in migration 0016. Each one is
 * deleted afterwards, and deleting an auth user cascades to its profile.
 */
const url = process.env["SUPABASE_URL"] ?? "http://127.0.0.1:54321";
const anonKey =
  process.env["SUPABASE_ANON_KEY"] ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
/** See `repos/events` — deliberately not the production service-role variable (E1.7). */
const serviceKey =
  process.env["SUPABASE_LOCAL_SERVICE_KEY"] ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const anon = createClient(url, anonKey, { auth: { persistSession: false } });
const service = createClient(url, serviceKey, { auth: { persistSession: false } });

async function reachable(): Promise<boolean> {
  try {
    const { error } = await anon.from("profiles").select("id").limit(1);
    return error === null;
  } catch {
    return false;
  }
}

const online = await reachable();
const suite = online ? describe : describe.skip;

suite("repos/profiles", () => {
  /** Unique per run: the suite deletes its own users but a crashed run should not collide. */
  const email = `bootstrap-${Date.now()}@example.test`;
  let userId = "";

  beforeAll(async () => {
    const { data, error } = await service.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        full_name: "Nissa of the Third Path",
        avatar_url: "https://cdn.discordapp.com/avatars/1/2.png",
      },
    });

    if (error !== null) throw new Error(`could not create the test user: ${error.message}`);
    userId = data.user.id;
  });

  afterAll(async () => {
    if (userId !== "") await service.auth.admin.deleteUser(userId);
  });

  it("creates a profile the moment the auth user exists", async () => {
    // Nothing in this test signed in, and no application code ran. If the row is
    // here, the trigger is what put it here.
    const profile = await getProfile(anon, userId);

    expect(profile).not.toBeNull();
    expect(profile?.displayName).toBe("Nissa of the Third Path");
    expect(profile?.avatarUrl).toBe("https://cdn.discordapp.com/avatars/1/2.png");
  });

  it("starts everyone at reader, with no handle claimed", () => {
    return getProfile(anon, userId).then((profile) => {
      expect(profile?.role).toBe("reader");
      // A Discord username is not unique; claiming one on sign-up would hand the
      // first arrival a name the second could never have.
      expect(profile?.handle).toBeNull();
    });
  });

  it("reads back by handle once one is chosen", async () => {
    await updateProfile(service, userId, {
      displayName: "Nissa",
      handle: "nissa",
      bio: "Plays green.",
    });

    const found = await getProfileByHandle(anon, "nissa");
    expect(found?.id).toBe(userId);
    expect(found?.bio).toBe("Plays green.");
  });

  it("leaves the role alone on a self-edit", async () => {
    const profile = await updateProfile(service, userId, {
      displayName: "Nissa Revane",
      handle: "nissa",
      bio: null,
    });

    // The column is not in the update statement at all, which is the point:
    // a role grant is admin-only (E14.4) and cannot arrive through this door
    // even from a client that RLS would otherwise let through.
    expect(profile.role).toBe("reader");
  });

  it("refuses an edit from someone who is not signed in", async () => {
    await expect(
      updateProfile(anon, userId, { displayName: "Hacked", handle: null, bio: null }),
    ).rejects.toThrow(/updateProfile failed/);
  });

  /**
   * `profiles_self_update` (migration 0001), from the signed-in side.
   *
   * The profile page's edit form depends on all three of these, and none of them
   * is visible in the repository — the policy is the whole implementation. The
   * full allow-deny matrix across every table is E14.5; these are the three rows
   * of it that shipped code already relies on.
   */
  describe("under the signed-in person's own session", () => {
    const password = "not-a-secret-either";
    let ownerId = "";
    let owner = anon;
    let neighbourId = "";

    beforeAll(async () => {
      const created = await service.auth.admin.createUser({
        email: `owner-${Date.now()}@example.test`,
        password,
        email_confirm: true,
      });
      ownerId = created.data.user?.id ?? "";

      const other = await service.auth.admin.createUser({
        email: `neighbour-${Date.now()}@example.test`,
        email_confirm: true,
      });
      neighbourId = other.data.user?.id ?? "";

      // A client of its own: signing in on the shared `anon` client would leave
      // every later test authenticated as this person.
      owner = createClient(url, anonKey, { auth: { persistSession: false } });
      const { error } = await owner.auth.signInWithPassword({
        email: created.data.user?.email ?? "",
        password,
      });
      if (error !== null) throw new Error(`could not sign in: ${error.message}`);
    });

    afterAll(async () => {
      if (ownerId !== "") await service.auth.admin.deleteUser(ownerId);
      if (neighbourId !== "") await service.auth.admin.deleteUser(neighbourId);
    });

    it("lets a person edit their own profile", async () => {
      const saved = await updateProfile(owner, ownerId, {
        displayName: "Chandra",
        handle: null,
        bio: "Burn.",
      });

      expect(saved.displayName).toBe("Chandra");
      expect(saved.bio).toBe("Burn.");
    });

    it("refuses to let a person promote themselves", async () => {
      // Not through `updateProfile`, which omits the column — straight at the
      // table, the way an attacker would. The `with check` clause is the only
      // thing standing here, and if it stopped working nothing else would notice.
      const { error } = await owner.from("profiles").update({ role: "admin" }).eq("id", ownerId);

      expect(error?.code).toBe("42501");
      expect(await getProfile(anon, ownerId).then((p) => p?.role)).toBe("reader");
    });

    it("refuses to let a person edit somebody else", async () => {
      // No error: the `using` clause makes the row invisible to the update, so
      // it matches nothing. Silent, which is why the assertion is on the row.
      await owner.from("profiles").update({ bio: "not mine to write" }).eq("id", neighbourId);

      expect(await getProfile(anon, neighbourId).then((p) => p?.bio)).toBeNull();
    });
  });

  it("has no answer for an id that is not a person", async () => {
    expect(await getProfile(anon, "00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  it("removes the profile with the account", async () => {
    const { data } = await service.auth.admin.createUser({
      email: `cascade-${Date.now()}@example.test`,
      email_confirm: true,
    });
    const transient = data.user?.id ?? "";

    expect(await getProfile(anon, transient)).not.toBeNull();
    await service.auth.admin.deleteUser(transient);
    expect(await getProfile(anon, transient)).toBeNull();
  });
});
