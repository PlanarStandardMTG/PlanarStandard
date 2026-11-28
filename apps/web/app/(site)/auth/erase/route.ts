import { eraseOwnProfile } from "@ps/db";
import { redirect } from "next/navigation";

import { requireViewer } from "@/lib/auth/guard";
import { createSessionClient } from "@/lib/supabase/session";

/**
 * Delete your account, irreversibly (E16.10).
 *
 * The confirmation is a typed word rather than a checkbox, because this cannot
 * be undone and a misclick should not be enough. It is checked here as well as
 * in the browser: `required` and `pattern` on an input are a convenience, and
 * this route is reachable without either.
 *
 * The work happens in `erase_own_profile`, a database function that takes no
 * argument — the subject is `auth.uid()`, read from the token inside Postgres.
 * So "only yourself" is true of the database rather than of this file, and stays
 * true if this file is ever wrong.
 */
const CONFIRMATION = "DELETE";

export async function POST(request: Request): Promise<never> {
  await requireViewer();

  const form = await request.formData();
  if (form.get("confirm")?.toString().trim().toUpperCase() !== CONFIRMATION) {
    redirect("/account/data?error=confirm");
  }

  const supabase = await createSessionClient();
  await eraseOwnProfile(supabase);

  // The account is gone, but this browser is still holding its cookies. Clearing
  // them is what makes the next page load say "signed out" rather than fail to
  // find the user the token names.
  await supabase.auth.signOut();

  redirect("/?erased=1");
}
