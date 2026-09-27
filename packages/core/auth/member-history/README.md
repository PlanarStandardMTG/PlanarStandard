# member-history

**Purpose.** Who may open a member's history page, and who may remove what is on it (E20.42).

**Inputs.** The viewer's role and ban, or null when signed out.
**Outputs.** `canViewHistory` → writer and up · `canRemoveContent` → admin · `HISTORY_ROLE`.

**Gotchas.** A banned viewer clears neither, as `has_role` says in SQL. Removal is also refused by
the `admin_*` functions in migration 0033; this is the pages' half.
