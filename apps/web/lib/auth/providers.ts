/**
 * The OAuth providers offered on the sign-in page (E16.9).
 *
 * Adding one is an entry here plus a block in `supabase.config.toml` and the
 * credentials in the Supabase dashboard — no route, no page, no component. The
 * sign-in form posts the id and `/auth/oauth` looks it up, so an id that is not
 * in this table cannot be used to start a flow.
 *
 * Email is not here. It is not an OAuth provider, it needs a password or a link
 * rather than a redirect, and pretending otherwise would put a fourth button
 * next to three that behave differently.
 */
export interface OAuthProvider {
  readonly id: string;
  readonly label: string;
  /** The provider's own brand colour, which is what makes these recognisable. */
  readonly className: string;
}

export const OAUTH_PROVIDERS: readonly OAuthProvider[] = [
  {
    id: "google",
    label: "Google",
    className: "border border-ink-300 bg-white text-ink-800 hover:bg-ink-50",
  },
  {
    id: "discord",
    label: "Discord",
    className: "bg-[#5865F2] text-white hover:bg-[#4752c4]",
  },
];

export function isOAuthProvider(value: unknown): value is string {
  return typeof value === "string" && OAUTH_PROVIDERS.some((provider) => provider.id === value);
}
