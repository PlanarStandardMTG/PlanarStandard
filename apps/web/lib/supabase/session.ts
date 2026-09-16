import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * The signed-in visitor's client (E16.2).
 *
 * Distinct from `createPublicClient`, which is anonymous by construction and is
 * what every public page reads through. This one carries the session cookies, so
 * `auth.uid()` is populated and RLS sees a person rather than the anon role.
 * Both use the anon key: the difference is who the request is, not what it is
 * allowed to bypass.
 */
export async function createSessionClient(): Promise<SupabaseClient> {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const anonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];

  if (url === undefined || anonKey === undefined) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set. " +
        "Run `pnpm db:start` and copy apps/web/.env.example to apps/web/.env.local.",
    );
  }

  const store = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (written) => {
        try {
          for (const { name, value, options } of written) store.set(name, value, options);
        } catch {
          // A Server Component cannot set cookies — only a route handler, a
          // server action, or middleware can. All three of those paths do set
          // them, and the middleware refresh runs before the render, so a
          // rendering component has nothing left to write. Rethrowing here would
          // turn a page view into a 500 to no purpose.
        }
      },
    },
  });
}
