"use server";

import type { Profile } from "@ps/contracts";
import { checkModeration, isUserRole } from "@ps/core";
import { getProfile, setMemberBanned, setMemberRole } from "@ps/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/guard";
import type { Viewer } from "@/lib/auth/viewer";
import { createSessionClient } from "@/lib/supabase/session";

/**
 * Role grants and bans (E20.21).
 *
 * The target comes from the form — that is the point of the page — so it is
 * checked by `checkModeration` here and by `profiles_admin_update` underneath,
 * which refuses an admin acting on themselves whatever this file believes.
 * Outcomes travel back as codes, like `/profile`'s.
 */
async function target(viewer: Viewer, form: FormData): Promise<Profile> {
  const supabase = await createSessionClient();
  const id = form.get("id")?.toString() ?? "";
  const profile = id === "" ? null : await getProfile(supabase, id);
  if (profile === null) redirect("/admin/users?error=missing");

  const check = checkModeration(viewer.profile, profile);
  if (!check.ok) redirect(`/admin/users?error=${check.problem}`);
  return profile;
}

export async function changeMemberRole(form: FormData): Promise<never> {
  const viewer = await requireRole("admin");
  const member = await target(viewer, form);

  const role = form.get("role")?.toString();
  if (!isUserRole(role)) redirect("/admin/users?error=role");

  await setMemberRole(await createSessionClient(), member.id, role);
  revalidatePath("/admin", "layout");
  redirect("/admin/users?done=role");
}

export async function changeMemberBan(form: FormData): Promise<never> {
  const viewer = await requireRole("admin");
  const member = await target(viewer, form);
  const ban = form.get("ban") === "1";

  await setMemberBanned(await createSessionClient(), member.id, ban);
  revalidatePath("/admin", "layout");
  redirect(`/admin/users?done=${ban ? "banned" : "unbanned"}`);
}
