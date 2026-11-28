import { redirect } from "next/navigation";

import { createSessionClient } from "@/lib/supabase/session";

/**
 * End the session (E16.3).
 *
 * POST only, and deliberately. A sign-out on GET can be fired by any page on the
 * internet with an `<img src="https://planarstandard.com/auth/sign-out">`, which
 * is a small piece of griefing that costs nothing to make impossible.
 */
export async function POST(): Promise<never> {
  const supabase = await createSessionClient();
  await supabase.auth.signOut();

  redirect("/");
}
