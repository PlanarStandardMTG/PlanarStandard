# `repos/content`

Reads over `posts` and `post_revisions` (§16, E13.22), and each post's reactions (E20.41).

**Inputs.** A `SupabaseClient` supplied by the caller — this package never reads
the environment, so the same functions serve a server component, a job, and a
test against a local instance.

**Outputs.** `PostWithAuthor` from `@ps/contracts`. The snake_case row shape does
not leave `rows.ts`.

**Gotchas.** Every function filters `status = 'published'` _and_ is backed by the
RLS policy in `0002_content.sql`; the filter is for readability, not safety. A
post whose author profile has been deleted still renders, with the byline
degraded to "Unknown author", because losing the article would be the worse
failure.

Writes go out as the caller: `deleteOwnPost` (E20.47) leans on `posts_author_delete`,
so a post that is not the caller's simply is not deleted, and it returns `false`.
