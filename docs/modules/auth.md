# Signing in, and who may see what

How someone signs in, how a route says who it is for, and what to do when you
add the next protected page. Epics E16 and E20.1, with E14 underneath.

Everything on this site is readable without an account. Signing in is for
**writing** — publishing an article, importing a tournament, editing the
banlist — and that shapes every decision below. An account is never a gate in
front of information the community already published.

## Discord, and nothing else

The format's community lives on Discord, organizers are already known to each
other there, and every account the site cares about has one. A second provider
would mean a second identity to reconcile against the same person for nobody's
benefit.

§17 of the plan accepts the cost: Discord login is one of only two tasks in the
repository that need real credentials. Nothing else does, which is why a fresh
clone still runs the whole site.

The provider is configured in Supabase, not here — the dashboard in production,
`packages/db/supabase.config.toml` locally. **No Vercel environment variable is
involved**, and there is no `DISCORD_*` secret anywhere in the app.

## The flow

```
/login                       form POST, no JavaScript required
  └─ POST /auth/sign-in      signInWithOAuth → Discord, PKCE verifier cookie set
       └─ discord.com
            └─ GET /auth/callback?code=…&next=…
                 ├─ exchangeCodeForSession → session cookies
                 └─ redirect to `next`
```

A profile row already exists by the time the callback runs. It is created by a
trigger on `auth.users` (migration 0016), not by this code path — every table
that attributes anything points at `profiles`, so the row is made by the same
statement that makes the user. An account created from the Supabase dashboard
gets one too.

Three things are worth stating because each is a way this goes wrong:

**Sign-out is POST-only.** A sign-out on GET can be fired by any page on the
internet with an `<img>` tag.

**`next` is validated before it reaches a `Location` header.** `safeNextPath`
rejects absolute URLs, protocol-relative paths (`//evil.example` starts with a
slash and still leaves the site), and control characters. Without it the login
page is an open redirect wearing the site's own credibility.

**`getUser`, never `getSession`.** `getSession` reads the cookie and believes
it. `getUser` revalidates with the auth server. On a page deciding what someone
may see, that is the difference between a forged cookie being rejected and being
authenticated.

## Where the session is kept alive

`apps/web/proxy.ts` — `proxy.ts` and not `middleware.ts`, which Next 16
deprecated. Access tokens last an hour, and a Server Component is not allowed to
set cookies, so nothing else in the request cycle can refresh one. Without it a
signed-in visitor is quietly signed out mid-visit.

**It is not the authorization boundary and must not become one.** It refreshes a
session, and it records the requested path in a header so a guard can send
someone back where they were going. A proxy runs in front of the app: it can be
skipped by a request that never matches, it has been bypassable by header before
(CVE-2025-29927), and it knows nothing about the row a page is about to read.

## Three layers, saying the same thing

| Layer                             | Stops                       | Lives in                    |
| --------------------------------- | --------------------------- | --------------------------- |
| Hiding a link                     | nothing — it is a courtesy  | `lib/auth/dashboard-sections.ts` |
| `requireRole` in a page or layout | a page from rendering       | `lib/auth/guard.ts`         |
| RLS                               | a row from moving           | migrations, E14             |

Only the third is a control in the security sense. The first two exist so people
are not shown doors they cannot open, and so a page does not have to render
before discovering it should not have. **A guard that ever disagrees with a
policy is a bug in the guard, never a permission.**

## Adding a protected route

The guard is the first statement in the page or layout, and the call site is the
declaration — there is no registry of protected routes anywhere. A new page under
`/dashboard` cannot be left unguarded by forgetting to add it to a list it does
not know exists.

```tsx
export default async function FormatAdminPage() {
  const viewer = await requireRole("admin");
  // …everything below can assume an admin
}
```

- **`requireViewer()`** — anyone signed in. Signed out, they go to `/login` with
  their destination remembered and come back to it.
- **`requireRole(role)`** — at or above a rung of the ladder.

Both are memoised per request through `currentViewer`, so a layout and its page
may both ask and only one lookup happens. **Guard in both anyway.** A layout's
check is real, but a page that depends on its parent for authorization is one
route move away from having none.

A layout guard sets the floor for a segment and cannot express "organizer here,
admin there" — so `/dashboard` guards at `writer` and each section guards itself
again at what it actually needs.

## What happens when someone cannot get in

Two different situations, deliberately handled differently:

**Signed out** → `/login?next=…`, because signing in may be all that is needed.
They land back on the page they asked for.

**Signed in, but short of the bar** → `/unauthorized?from=…&need=…`, which is a
page and not a redirect home. Someone bounced silently to the home page cannot
tell a permission from a broken link, and will try the same link again. The page
names the path, what it needs, what their account is, and where to ask. Both
parameters are display-only and validated anyway; the page grants nothing, so the
worst a forged link does is show a sentence that is not true.

## The role ladder

`reader < writer < organizer < admin`, compared by `core/auth/meets-role`.

They are a ladder and not a set of independent permissions: an organizer may do
anything a writer may. That holds because the format's organizers are also the
people who write the event recaps, and a site this size does not need two grants
where one will do. The day it stops holding, `meets-role` is the only module
that changes — which is why callers ask it instead of comparing roles themselves.

**Nobody can grant themselves a role.** `updateProfile` omits the column, and
`profiles_self_update`'s `with check` clause refuses a change to it even from a
client that goes straight at the table. Both are asserted in
`packages/db/repos/profiles/index.test.ts`. Granting is admin-only and lands with
E14.4; until then it is an `update` in the SQL editor.

## Working on this without a Discord app

The seeded accounts have passwords, and local Supabase accepts email sign-in even
though the site does not offer it. That is enough to develop a protected page
without registering a Discord application — sign in through Supabase Studio, or
mint a session with `signInWithPassword` against the local instance.

The seed's five accounts cover writer, organizer, and admin, so the role-aware
parts of the UI have something to render for every rung.

## Modules

| Module                                | Job                                                     |
| ------------------------------------- | ------------------------------------------------------- |
| `core/auth/meets-role`                | does this role clear that bar                           |
| `core/auth/profile-handle`            | what a person may call themselves in a URL              |
| `db/repos/profiles`                   | read a profile, save a person's own edits               |
| `db/migrations/0016_profile_bootstrap`| the trigger that makes the row                          |
| `web/proxy.ts`                        | keeps the session alive; decides nothing                |
| `web/lib/supabase/session.ts`         | the cookie-bound client                                 |
| `web/lib/auth/viewer.ts`              | the one place a cookie becomes a person                 |
| `web/lib/auth/guard.ts`               | `requireViewer`, `requireRole`                          |
| `web/lib/auth/next-path.ts`           | where it is safe to send somebody afterwards            |
| `web/lib/auth/current-path.ts`        | what path this render is for                            |
| `web/lib/auth/dashboard-sections.ts`  | what is behind the dashboard, and who each part is for  |
