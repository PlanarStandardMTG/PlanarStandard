import { CONTACT_NAME_MAX_LENGTH, HANDLE_MAX_LENGTH, HANDLE_MIN_LENGTH } from "@ps/core";
import { getProfileContacts } from "@ps/db";
import type { Metadata } from "next";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { requireViewer } from "@/lib/auth/guard";
import { formatTimeAgo } from "@/lib/format-date";
import { createSessionClient } from "@/lib/supabase/session";

import { saveProfile } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your profile",
  // Somebody's own account page is not a search result.
  robots: { index: false, follow: false },
};

/**
 * The one page every signed-in account has (E20.20).
 *
 * Also the worked example for every protected route that follows: the guard is
 * the first statement, it returns the viewer, and nothing below it has to think
 * about whether somebody is signed in.
 */
const ERRORS: Readonly<Record<string, string>> = {
  "name-empty": "A display name cannot be blank.",
  "name-long": "That display name is too long.",
  "bio-long": "That bio is too long.",
  "handle-too-short": `A handle needs at least ${HANDLE_MIN_LENGTH} characters.`,
  "handle-too-long": `A handle can be at most ${HANDLE_MAX_LENGTH} characters.`,
  "handle-charset":
    "A handle can use letters, numbers, hyphens, and underscores, and has to start and end with a letter or number.",
  "handle-reserved": "That handle is reserved.",
  "handle-taken": "Somebody already has that handle.",
  "arena-tag":
    "An Arena username needs its tag, like Brayzon#12345 — a Direct Challenge needs the whole thing.",
  "arena-too-long": "That Arena username is too long.",
  "discord-too-long": "That Discord name is too long.",
  banned: "A banned account cannot edit its profile.",
};

const ROLE_BLURBS: Readonly<Record<string, string>> = {
  reader: "You can read everything on the site and submit decklists.",
  writer: "You can write and publish community posts directly.",
  organizer: "You can create tournaments and import results.",
  admin: "You can edit the format, merge identities, and grant roles.",
};

const FIELD =
  "mt-1.5 w-full rounded-lg border border-ink-300 bg-paper px-3 py-2 text-sm " +
  "focus:border-eclipse-500 focus:outline-none dark:border-ink-700 dark:bg-ink-950";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Signed out, this redirects to /login and comes back here afterwards.
  const viewer = await requireViewer();
  const { profile, email } = viewer;
  const contacts = await getProfileContacts(await createSessionClient(), profile.id);

  const params = await searchParams;
  const rawError = typeof params["error"] === "string" ? params["error"] : null;
  const error = rawError === null ? null : (ERRORS[rawError] ?? "That could not be saved.");
  const savedWhat = typeof params["saved"] === "string" ? params["saved"] : null;
  const saved = error === null && savedWhat !== null;

  return (
    <div className="max-w-xl">
      <header className="flex items-center gap-4">
        {profile.avatarUrl !== null && (
          // A provider's CDN — Google's or Discord's — and not our own
          // uploads, so a plain img rather than next/image, which would need
          // every provider's host listed in next.config.ts.
          <img
            src={profile.avatarUrl}
            alt=""
            width={56}
            height={56}
            className="size-14 rounded-full border border-ink-200 dark:border-ink-800"
          />
        )}
        <div>
          <h1 className="font-display text-4xl tracking-tight sm:text-5xl">
            {profile.displayName}
          </h1>
          <p className="text-sm text-ink-500 dark:text-ink-400">
            Joined {formatTimeAgo(profile.createdAt, new Date())}
          </p>
        </div>
      </header>

      <Card className="mt-8 p-6">
        <h2 className="font-display text-lg font-semibold">
          {profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}
        </h2>
        <p className="mt-1 text-sm text-ink-600 dark:text-ink-400">
          {ROLE_BLURBS[profile.role]} Roles are granted by the format&rsquo;s admins — there is
          nothing to request here.
        </p>
        {email !== null && (
          <p className="mt-3 text-sm text-ink-500 dark:text-ink-400">
            Signed in with {email}. Only you can see this.
          </p>
        )}
        <p className="mt-3 text-sm">
          <Link
            href="/account/password"
            className="font-medium text-eclipse-700 hover:underline dark:text-eclipse-400"
          >
            Set a new password
          </Link>
          <span className="text-ink-500 dark:text-ink-400">
            {" "}
            — including if you have only ever signed in with a link or a provider.
          </span>
        </p>
        <p className="mt-2 text-sm">
          <Link
            href="/account/data"
            className="font-medium text-eclipse-700 hover:underline dark:text-eclipse-400"
          >
            Your data
          </Link>
          <span className="text-ink-500 dark:text-ink-400">
            {" "}
            — what we hold, how to take a copy, and how to delete your account.
          </span>
        </p>
      </Card>

      <Card className="mt-6 p-6">
        <h2 className="font-display text-lg font-semibold">Edit</h2>

        {error !== null && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
          >
            {error}
          </p>
        )}
        {saved && (
          <p
            role="status"
            className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
          >
            {savedWhat === "password" ? "Your new password is saved." : "Saved."}
          </p>
        )}

        <form action={saveProfile} className="mt-5 space-y-5">
          <div>
            <label htmlFor="displayName" className="text-sm font-medium">
              Display name
            </label>
            <input
              id="displayName"
              name="displayName"
              defaultValue={profile.displayName}
              maxLength={60}
              required
              className={FIELD}
            />
            <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
              How you are credited on anything you write.
            </p>
          </div>

          <div>
            <label htmlFor="handle" className="text-sm font-medium">
              Handle
            </label>
            <input
              id="handle"
              name="handle"
              defaultValue={profile.handle ?? ""}
              minLength={HANDLE_MIN_LENGTH}
              maxLength={HANDLE_MAX_LENGTH}
              autoComplete="off"
              className={FIELD}
            />
            <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
              Your name in events run on the site: your matches there are recorded under it, so you
              need one to register. Letters, numbers, hyphens and underscores.
            </p>
          </div>

          <div>
            <label htmlFor="bio" className="text-sm font-medium">
              Bio
            </label>
            <textarea
              id="bio"
              name="bio"
              defaultValue={profile.bio ?? ""}
              maxLength={280}
              rows={3}
              className={FIELD}
            />
          </div>

          <fieldset className="space-y-5 border-t border-ink-200 pt-5 dark:border-ink-800">
            <legend className="sr-only">How opponents reach you</legend>
            <p className="text-sm text-ink-600 dark:text-ink-400">
              For events run on the site. Only you, admins, the organizer of an event you are in,
              and your opponent while you are paired can see these — never the leaderboard or a
              public page.
            </p>
            <div>
              <label htmlFor="arenaUsername" className="text-sm font-medium">
                Arena username
              </label>
              <input
                id="arenaUsername"
                name="arenaUsername"
                defaultValue={contacts?.arenaUsername ?? ""}
                maxLength={CONTACT_NAME_MAX_LENGTH}
                placeholder="Brayzon#12345"
                autoComplete="off"
                className={FIELD}
              />
              <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
                With the # tag, so your opponent can send you a Direct Challenge.
              </p>
            </div>
            <div>
              <label htmlFor="discordName" className="text-sm font-medium">
                Discord name
              </label>
              <input
                id="discordName"
                name="discordName"
                defaultValue={contacts?.discordName ?? ""}
                maxLength={CONTACT_NAME_MAX_LENGTH}
                autoComplete="off"
                className={FIELD}
              />
              <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
                In case an organizer or admin needs to reach you.
              </p>
            </div>
          </fieldset>

          <button
            type="submit"
            className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-700 dark:bg-ink-100 dark:text-ink-900 dark:hover:bg-paper"
          >
            Save changes
          </button>
        </form>
      </Card>
    </div>
  );
}
