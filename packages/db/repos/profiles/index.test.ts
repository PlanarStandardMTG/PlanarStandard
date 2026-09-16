import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  eraseOwnProfile,
  getProfile,
  getProfileByHandle,
  getProfileByUserId,
  updateProfile,
} from "./index";

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
    if (userId !== "") {
      await service.auth.admin.deleteUser(userId);
      // The tombstone erasure leaves behind (E16.10) is correct in production
      // and is litter here.
      await service.from("profiles").delete().eq("id", userId);
    }
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
      for (const id of [ownerId, neighbourId].filter((value) => value !== "")) {
        await service.auth.admin.deleteUser(id);
        await service.from("profiles").delete().eq("id", id);
      }
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

  it("scrubs the profile when the account is deleted by any route", async () => {
    // Deleted straight through the admin API, the way Supabase Studio does it —
    // not through `erase_own_profile`. The trigger is what makes every route
    // erase rather than just the one the site offers, and an admin deleting a
    // row by hand is the route most likely to leave a name behind.
    const { data } = await service.auth.admin.createUser({
      email: `cascade-${Date.now()}@example.test`,
      email_confirm: true,
      user_metadata: { full_name: "Briefly Here" },
    });
    const transient = data.user?.id ?? "";
    const profile = await getProfileByUserId(service, transient);
    expect(profile?.displayName).toBe("Briefly Here");

    await service.auth.admin.deleteUser(transient);

    // The row survives: eight tables reference `profiles` and two of those
    // columns are `not null`, so deleting it is not something the schema allows.
    const tombstone = await getProfile(anon, profile?.id ?? "");
    expect(tombstone).not.toBeNull();
    expect(tombstone?.displayName).toBe("Deleted member");
    expect(tombstone?.deletedAt).not.toBeNull();
    // And nothing links it to an account any more.
    expect(await getProfileByUserId(service, transient)).toBeNull();

    // The tombstone is correct in production and is litter here.
    await service
      .from("profiles")
      .delete()
      .eq("id", profile?.id ?? "");
  });
});

/**
 * Erasure (E16.10). The property under test is not "the row went away" — it did
 * not, and must not: eight tables reference `profiles` and two of those columns
 * are `not null`. It is that nothing identifying survives, that the account is
 * genuinely gone, and that nobody can aim any of it at anybody else.
 */
suite("erase_own_profile", () => {
  const password = "erasure-test-password";
  let subjectId = "";
  let subjectProfileId = "";
  let subject = anon;
  let bystanderId = "";

  beforeAll(async () => {
    const created = await service.auth.admin.createUser({
      email: `erasure-${Date.now()}@example.test`,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Departing Member" },
    });
    subjectId = created.data.user?.id ?? "";

    const other = await service.auth.admin.createUser({
      email: `bystander-${Date.now()}@example.test`,
      email_confirm: true,
      user_metadata: { full_name: "Still Here" },
    });
    bystanderId = other.data.user?.id ?? "";

    const profile = await getProfileByUserId(service, subjectId);
    subjectProfileId = profile?.id ?? "";

    await updateProfile(service, subjectProfileId, {
      displayName: "Departing Member",
      handle: `departing${Date.now()}`,
      bio: "Something personal.",
    });

    subject = createClient(url, anonKey, { auth: { persistSession: false } });
    const { error } = await subject.auth.signInWithPassword({
      email: created.data.user?.email ?? "",
      password,
    });
    if (error !== null) throw new Error(`could not sign in: ${error.message}`);
  });

  afterAll(async () => {
    if (bystanderId !== "") {
      await service.auth.admin.deleteUser(bystanderId);
      await service.from("profiles").delete().eq("id", bystanderId);
    }
    if (subjectProfileId !== "") await service.from("profiles").delete().eq("id", subjectProfileId);
  });

  it("refuses to let anyone choose whose account is erased", async () => {
    // `erase_profile(uuid)` is the one that takes a subject, and no client-facing
    // role may execute it. Supabase grants execute to `anon` and `authenticated`
    // on every new function in `public` by default, so this is asserting a
    // revoke that has to be written by hand and is easy to leave out.
    const { error } = await subject.rpc("erase_profile", { p_user_id: bystanderId });
    expect(error).not.toBeNull();

    const bystander = await getProfileByUserId(service, bystanderId);
    expect(bystander?.displayName).toBe("Still Here");
    expect(bystander?.deletedAt).toBeNull();
  });

  it("refuses a signed-out caller", async () => {
    const { error } = await anon.rpc("erase_own_profile");
    expect(error).not.toBeNull();
  });

  it("clears every identifying field and severs the account", async () => {
    await eraseOwnProfile(subject);

    const tombstone = await getProfile(anon, subjectProfileId);
    expect(tombstone).not.toBeNull();
    expect(tombstone?.displayName).toBe("Deleted member");
    expect(tombstone?.handle).toBeNull();
    expect(tombstone?.bio).toBeNull();
    expect(tombstone?.avatarUrl).toBeNull();
    expect(tombstone?.deletedAt).not.toBeNull();

    // The account itself, with the email and the password hash on it.
    const { data } = await service.auth.admin.getUserById(subjectId);
    expect(data.user).toBeNull();
  });

  it("leaves no way to find the tombstone from the account it came from", async () => {
    expect(await getProfileByUserId(service, subjectId)).toBeNull();
  });

  it("does not take the bystander with it", async () => {
    const bystander = await getProfileByUserId(service, bystanderId);
    expect(bystander?.displayName).toBe("Still Here");
  });
});
