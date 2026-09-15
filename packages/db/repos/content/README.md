# `repos/content`

Reads over `posts` and `post_revisions` (§16, E13.22).

**Inputs.** A `SupabaseClient` supplied by the caller — this package never reads
the environment, so the same functions serve a server component, a job, and a
test against a local instance.

**Outputs.** `PostWithAuthor` from `@ps/contracts`. The snake_case row shape does
not leave `rows.ts`.

**Gotchas.** Every function filters `status = 'published'` *and* is backed by the
RLS policy in `0002_content.sql`; the filter is for readability, not safety. A
post whose author profile has been deleted still renders, with the byline
degraded to "Unknown author", because losing the article would be the worse
failure.
