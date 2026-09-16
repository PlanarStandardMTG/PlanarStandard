# Signing in, and who may see what

How someone signs in, how a route says who it is for, and what to do when you
add the next protected page. Epics E16 and E20.1, with E14 underneath.

Everything on this site is readable without an account. Signing in is for
**writing** — publishing an article, importing a tournament, editing the
banlist — and that shapes every decision below. An account is never a gate in
front of information the community already published.

## Several ways in, none of them required

| Method                 | What it needs                     | Also signs you up |
| ---------------------- | --------------------------------- | ----------------- |
| Email and password     | nothing but an address            | via `/signup`     |
| Emailed sign-in link   | nothing but an address            | **yes**           |
| Google                 | a Google account                  | yes               |
| Discord                | a Discord account                 | yes               |

**No provider is privileged, and Discord in particular is not.** The format's
community lives there, but requiring it would turn "read this site" into "join
our chat server first". It is one option among several.

That leaves Discord's real use — knowing which Discord member a player is — as a
thing to ask for **later, when a feature earns it**, rather than a toll at the
door. Someone who signs in with an emailed link today can link a Discord identity
the day the site does something with it. `identity_source` in §12 already has a
`discord_oauth` member for exactly that, and Supabase's `linkIdentity` attaches a
provider to an account that already exists. Nothing in this epic needs it.

Which OAuth buttons appear is decided by the project, not the repository:
`lib/auth/enabled-providers.ts` asks Supabase's public `/auth/v1/settings` which
providers are switched on. Turning Google off is a toggle in the dashboard, and
the button goes away without a deploy. With none configured, email and the magic
link are a complete way in on their own.

## The flows

```
Password        /login → POST /auth/password → session → next
Sign up         /signup → POST /auth/sign-up → email → /auth/confirm → next
Magic link      /login → POST /auth/magic-link → email → /auth/confirm → next
OAuth           /login → POST /auth/oauth → provider → /auth/callback → next
Reset           /forgot-password → POST /auth/recover → email
                  → /auth/confirm → /account/password → POST /auth/update-password
```

Every route that can change a credential is under `app/auth/`, so the whole
surface can be read in one sitting. Every one of them is a POST from a plain
form: signing in changes state, and a GET would let a prefetch, a crawler or an
`<img>` tag start a round trip nobody asked for. Nothing in the flow is a client
component, so it all works with JavaScript off.

A profile row already exists by the time any of this finishes. It is created by a
trigger on `auth.users` (migration 0016), not by any code path above — every
table that attributes anything points at `profiles`, so the row is made by the
same statement that makes the user.

## Email is infrastructure now

Two of the four ways in are an email, and so is every password reset. **That
makes an SMTP provider a production dependency.** Supabase's built-in sender is
rate limited to a few messages an hour and is explicitly not for production use;
without a real one configured, magic links and resets fail quietly for most
people who try them.

Locally there is nothing to configure: Supabase runs Mailpit and every message
lands at <http://127.0.0.1:54324> instead of being delivered.

### Why the templates are ours

`packages/db/templates/` holds the four email bodies, linked into place by
`pnpm db:setup`. They exist for one reason: the default templates link to
`{{ .ConfirmationURL }}`, which sends the browser through Supabase's verify
endpoint and hands the result back in a URL **fragment**. A fragment never
reaches the server, so a server-rendered site cannot read it. Ours link to
`/auth/confirm?token_hash=…`, which is exchanged server-side — and which also
makes a link work when it is opened on a different device from the one that
asked for it.

Three things about editing them, each of which has already gone wrong once:

- **Build the URL from `RedirectTo`**, which carries the `?next=` the visitor was
  heading for. A hard-coded path silently drops it and lands everyone on the same
  page.
- **Never put a conditional at the start of an `href`.** Go's `html/template`
  refuses to autoescape a URL whose context it cannot work out, and fails with
  "appears in an ambiguous context within a URL".
- **Do not use the template delimiters in a comment.** Go parses comments too, so
  the word `if` between braces is an action with no argument — and a template
  that fails to parse is not an error anybody sees. GoTrue quietly falls back to
  its own default and sends that instead, which is how a working-looking flow
  ends up with an unreadable fragment in the URL.

## What is and is not hidden

**Confirmation is required, and that is load-bearing rather than tidy.** Supabase
links identities that share an email address. An *unconfirmed* password account
on somebody else's address would sit waiting to be linked to their Google
sign-in, handing whoever created it a password into the real owner's account.
Requiring confirmation is what makes "same email" mean "same person".

The **magic link** and the **password reset** never say whether an address has an
account. Both can be scripted against a list of addresses, and the answer goes to
the address rather than to the screen.

The **sign-up form does** say, and that is a deliberate trade. Supabase obfuscates
a repeat sign-up only while the first one is still unconfirmed; after that it
answers `user_already_exists`. Passing that through, with somewhere to go, beats
stranding the person who forgot they already signed up — which is a certainty —
in order to hide something any password form leaks anyway.

Failures travel as **codes**, not sentences: `?error=invalid-credentials`, never
`?error=<message>`. `lib/auth/auth-error.ts` turns a code into copy, so a crafted
link can only ever produce one of our sentences rather than arbitrary text on our
page over our name.

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

`getUser`, never `getSession`. `getSession` reads the cookie and believes it;
`getUser` revalidates with the auth server. On a page deciding what someone may
see, that is the difference between a forged cookie being rejected and being
authenticated.

## Three layers, saying the same thing

| Layer                             | Stops                      | Lives in                         |
| --------------------------------- | -------------------------- | -------------------------------- |
| Hiding a link                     | nothing — it is a courtesy | `lib/auth/dashboard-sections.ts` |
| `requireRole` in a page or layout | a page from rendering      | `lib/auth/guard.ts`              |
| RLS                               | a row from moving          | migrations, E14                  |

Only the third is a control in the security sense. The first two exist so people
are not shown doors they cannot open. **A guard that ever disagrees with a policy
is a bug in the guard, never a permission.**

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

Where somebody cannot get in, the two cases are handled differently on purpose.
**Signed out** → `/login?next=…`, because signing in may be all that is needed.
**Signed in and short of the bar** → `/unauthorized?from=…&need=…`, a page rather
than a redirect home: someone bounced silently to the home page cannot tell a
permission from a broken link, and will try the same link again.

## The role ladder

`reader < writer < organizer < admin`, compared by `core/auth/meets-role`.

They are a ladder and not a set of independent permissions: an organizer may do
anything a writer may. That holds because the format's organizers are also the
people who write the event recaps, and a site this size does not need two grants
where one will do. The day it stops holding, `meets-role` is the only module that
changes — which is why callers ask it instead of comparing roles themselves.

**Nobody can grant themselves a role.** `updateProfile` omits the column, and
`profiles_self_update`'s `with check` clause refuses a change to it even from a
client that goes straight at the table. Both are asserted in
`packages/db/repos/profiles/index.test.ts`. Granting is admin-only and lands with
E14.4; until then it is an `update` in the SQL editor.

## Working on this locally

Nothing needs registering. Sign up at `/signup` with any address, then open
<http://127.0.0.1:54324> and click the link in the message that arrives — the
whole sign-up, magic link, and reset surface works with no external account at
all.

The seeded accounts have passwords (`seed-password-not-a-secret`) and cover
writer, organizer, and admin, so the role-aware parts of the UI have something to
render for every rung.

To exercise an OAuth provider locally, register an application with it, point its
redirect URI at `http://127.0.0.1:54321/auth/v1/callback`, and export the two
variables named in `supabase.config.toml` before `pnpm db:start`.

## Modules

| Module                                 | Job                                                    |
| -------------------------------------- | ------------------------------------------------------ |
| `core/auth/meets-role`                 | does this role clear that bar                          |
| `core/auth/profile-handle`             | what a person may call themselves in a URL             |
| `core/auth/password-policy`            | what we require of a password, mirrored from Supabase  |
| `db/repos/profiles`                    | read a profile, save a person's own edits              |
| `db/migrations/0016_profile_bootstrap` | the trigger that makes the row                         |
| `db/templates/`                        | the four emails, and why they are not the defaults     |
| `web/proxy.ts`                         | keeps the session alive; decides nothing               |
| `web/app/auth/*`                       | every route that can change a credential               |
| `web/lib/supabase/session.ts`          | the cookie-bound client                                |
| `web/lib/auth/viewer.ts`               | the one place a cookie becomes a person                |
| `web/lib/auth/guard.ts`                | `requireViewer`, `requireRole`                         |
| `web/lib/auth/auth-error.ts`           | a failure becomes a code, and a code becomes a sentence |
| `web/lib/auth/providers.ts`            | the OAuth catalogue                                    |
| `web/lib/auth/enabled-providers.ts`    | which of them this project actually has                |
| `web/lib/auth/next-path.ts`            | where it is safe to send somebody afterwards           |
| `web/lib/auth/current-path.ts`         | what path this render is for                           |
| `web/lib/auth/dashboard-sections.ts`   | what is behind the dashboard, and who each part is for |
