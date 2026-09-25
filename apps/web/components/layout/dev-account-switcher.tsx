import { currentPath } from "@/lib/auth/current-path";
import { DEV_ACCOUNTS, DEV_PASSWORD, devAccountSwitcherEnabled } from "@/lib/auth/dev-accounts";
import { currentViewer } from "@/lib/auth/viewer";

/**
 * Sign in as any seeded account in one click — `next dev` only.
 *
 * Posts the seed password to the ordinary `/auth/password` route, so it adds no
 * way in that production does not already have; it only fills in the form. A
 * `<details>` and a form per account, like `oauth-buttons.tsx`, so it needs no
 * client JavaScript.
 */
export async function DevAccountSwitcher() {
  if (!devAccountSwitcherEnabled()) return null;

  const [viewer, next] = await Promise.all([currentViewer(), currentPath()]);

  return (
    <details className="relative shrink-0 text-sm">
      <summary
        className="cursor-pointer list-none rounded-md border border-dashed border-amber-400 px-2 py-1 text-xs font-medium text-amber-700 dark:border-amber-700 dark:text-amber-400"
        title="Local development only"
      >
        Dev: {viewer === null ? "sign in as…" : viewer.profile.role}
      </summary>
      <ul className="absolute right-0 z-50 mt-2 w-64 rounded-lg border border-ink-200 bg-white p-1 shadow-lg dark:border-ink-800 dark:bg-ink-950">
        {DEV_ACCOUNTS.map((account) => (
          <li key={account.email}>
            <form method="post" action="/auth/password">
              <input type="hidden" name="email" value={account.email} />
              <input type="hidden" name="password" value={DEV_PASSWORD} />
              <input type="hidden" name="next" value={next} />
              <button
                type="submit"
                className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-left hover:bg-ink-100 dark:hover:bg-ink-900"
              >
                <span>{account.name}</span>
                <span className="text-xs text-ink-500 dark:text-ink-400">{account.role}</span>
              </button>
            </form>
          </li>
        ))}
      </ul>
    </details>
  );
}
