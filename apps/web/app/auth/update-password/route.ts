import { checkPassword } from "@ps/core";
import { redirect } from "next/navigation";

import { authErrorCode } from "@/lib/auth/auth-error";
import { currentViewer } from "@/lib/auth/viewer";
import { createSessionClient } from "@/lib/supabase/session";

/**
 * Set a new password (E16.9).
 *
 * Reached two ways, and it does not need to know which: from a recovery link,
 * where `/auth/confirm` has just established a session, or from the account page
 * while already signed in. Either way there is a session, and `updateUser` acts
 * on whoever that session is — there is no user id in the form, so this cannot
 * be aimed at somebody else.
 *
 * Lives here rather than as a server action on the page so that every route that
 * can change a credential is in one directory and can be read in one sitting.
 */
export async function POST(request: Request): Promise<never> {
  const viewer = await currentViewer();
  if (viewer === null) redirect("/login?next=%2Faccount%2Fpassword");

  const form = await request.formData();
  const password = form.get("password")?.toString() ?? "";
  const confirmation = form.get("confirmation")?.toString() ?? "";

  if (password !== confirmation) redirect("/account/password?error=mismatch");

  const checked = checkPassword(password);
  if (!checked.ok) redirect(`/account/password?error=${checked.problem}`);

  const supabase = await createSessionClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error !== null) {
    redirect(`/account/password?error=${authErrorCode(error) ?? "unknown"}`);
  }

  redirect("/profile?saved=password");
}
