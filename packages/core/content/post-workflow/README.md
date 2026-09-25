# post-workflow

**Purpose.** Decide the status a post lands in when it is submitted or reviewed.

**Inputs.** The submitter's role, or a reviewer's decision.
**Outputs.** `submissionStatus` → `published` for writer and up, `review` below ·
`reviewedStatus` → `published` or `draft` · `canReview` · `isReviewDecision`.

**Gotchas.** The route guards' half of the rule. RLS on `posts` (migration 0019)
is the half that stops a write, and the two must agree — the RLS matrix asserts
the database side.
