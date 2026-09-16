import { OAUTH_PROVIDERS, type OAuthProvider } from "./providers";

/**
 * Which providers this deployment can actually use (E16.9).
 *
 * Whether Google is configured is decided in the Supabase dashboard, not in this
 * repository, so the site has to ask rather than assume. `/auth/v1/settings` is
 * public and says which providers are turned on — so switching one on or off is
 * a toggle over there and the button follows, with no deploy.
 *
 * The same shape as the event calendars: unconfigured is a state to render, not
 * a failure. A button that starts a flow the project cannot finish is worse than
 * no button, because the visitor cannot tell which of the two of us is broken.
 */
interface Settings {
  readonly external?: Readonly<Record<string, boolean>> | undefined;
}

export async function enabledProviders(): Promise<readonly OAuthProvider[]> {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const anonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  if (url === undefined || anonKey === undefined) return [];

  try {
    const response = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: anonKey },
      // Five minutes. This changes when somebody edits the dashboard, which is
      // rare, and a stale answer costs at most one confusing button.
      next: { revalidate: 300 },
    });

    if (!response.ok) return OAUTH_PROVIDERS;

    const settings = (await response.json()) as Settings;
    const external = settings.external;
    if (external === undefined) return OAUTH_PROVIDERS;

    return OAUTH_PROVIDERS.filter((provider) => external[provider.id] === true);
  } catch {
    // Fail open. If we cannot reach the settings endpoint the sign-in page is
    // already in trouble, and hiding every way in would make it worse.
    return OAUTH_PROVIDERS;
  }
}
