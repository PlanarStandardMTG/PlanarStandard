import { Divider } from "@/components/auth/form-parts";
import { enabledProviders } from "@/lib/auth/enabled-providers";
import { cn } from "@/lib/cn";

/**
 * One button per provider this deployment can actually use (E16.9).
 *
 * A form each, rather than one form with several submit buttons: a submit
 * button's value is not sent when a form is submitted by pressing Enter, so a
 * keyboard user would post no provider at all.
 *
 * Renders nothing — not even the divider — when no provider is configured, which
 * is every machine without OAuth credentials. Email and the magic link are a
 * complete way in on their own, so that is a working site rather than a broken
 * one.
 */
export async function OAuthButtons({ next }: { next: string }) {
  const providers = await enabledProviders();
  if (providers.length === 0) return null;

  return (
    <>
      <Divider>or</Divider>
      <div className="grid gap-3">
        {providers.map((provider) => (
          <form key={provider.id} method="post" action="/auth/oauth">
            <input type="hidden" name="next" value={next} />
            <input type="hidden" name="provider" value={provider.id} />
            <button
              type="submit"
              className={cn(
                "w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                "dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100 dark:hover:bg-ink-800",
                provider.className,
              )}
            >
              Continue with {provider.label}
            </button>
          </form>
        ))}
      </div>
    </>
  );
}
