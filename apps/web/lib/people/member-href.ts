/**
 * Where a name leads, for a viewer allowed to follow it (E20.42): a member's
 * history, or a handle's page, which sends a claimed handle on to its member.
 */
export type Person =
  | { readonly member: string }
  /** A player's id or slug, whichever the caller has. */
  | { readonly player: string };

export function personHref(person: Person): string {
  return "member" in person
    ? `/members/${person.member}`
    : `/members/player/${encodeURIComponent(person.player)}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whether a route segment is an id rather than a slug; a malformed id is a 404, not a 500. */
export function isUuid(value: string): boolean {
  return UUID.test(value);
}
