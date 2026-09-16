"use server";

import { checkProfileHandle } from "@ps/core";
import { updateProfile } from "@ps/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireViewer } from "@/lib/auth/guard";
import { createSessionClient } from "@/lib/supabase/session";

/**
 * Save a person's own profile (E20.20).
 *
 * `requireViewer` runs first and the id comes from the session, never from the
 * form — a server action is a public endpoint, and a hidden `id` field would be
 * an invitation to edit somebody else. The write then goes through the caller's
 * own client, so `profiles_self_update` gets the last word regardless of what
 * this function believes.
 *
 * Outcomes travel back as codes in the query string rather than as sentences,
 * so a crafted link cannot put arbitrary text on the page.
 */
const DISPLAY_NAME_MAX = 60;
const BIO_MAX = 280;

export async function saveProfile(form: FormData): Promise<never> {
  const viewer = await requireViewer();

  const displayName = (form.get("displayName")?.toString() ?? "").trim();
  const rawHandle = (form.get("handle")?.toString() ?? "").trim();
  const bio = (form.get("bio")?.toString() ?? "").trim();

  if (displayName === "") redirect("/profile?error=name-empty");
  if (displayName.length > DISPLAY_NAME_MAX) redirect("/profile?error=name-long");
  if (bio.length > BIO_MAX) redirect("/profile?error=bio-long");

  // An empty handle is a real choice — nobody is required to claim a URL — so
  // it clears the column rather than failing validation.
  let handle: string | null = null;
  if (rawHandle !== "") {
    const checked = checkProfileHandle(rawHandle);
    if (!checked.ok) redirect(`/profile?error=handle-${checked.problem}`);
    handle = checked.handle;
  }

  const supabase = await createSessionClient();

  try {
    await updateProfile(supabase, viewer.profile.id, { displayName, handle, bio: bio || null });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    // 23505 is the unique index on `handle`. Someone else got there first, which
    // is an ordinary thing to tell a person rather than a server error.
    if (message.includes("23505") || message.toLowerCase().includes("duplicate")) {
      redirect("/profile?error=handle-taken");
    }
    throw cause;
  }

  // The header shows the display name, and it is rendered by the root layout.
  revalidatePath("/", "layout");
  redirect("/profile?saved=1");
}
