"use server";

import type { Profile } from "@ps/contracts";
import { checkModeration } from "@ps/core";
import {
  adminDeletePost,
  adminRemoveDeck,
  adminRemoveMemberContent,
  getProfile,
  setMemberBanned,
} from "@ps/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/guard";
import { createSessionClient } from "@/lib/supabase/session";

/**
 * What an admin does from a member's history (E20.42). The `admin_*` functions
 * in migration 0033 refuse anybody else whatever this file believes; outcomes
 * travel back as codes, like `/admin/users`'.
 */
function back(memberId: string, query: string): never {
  revalidatePath("/", "layout");
  redirect(`/members/${memberId}?${query}`);
}

function field(form: FormData, name: string): string {
  return form.get(name)?.toString() ?? "";
}

export async function deleteMemberPost(form: FormData): Promise<never> {
  await requireRole("admin");
  await adminDeletePost(await createSessionClient(), field(form, "post"));
  back(field(form, "member"), "done=post");
}

export async function removeMemberDeck(form: FormData): Promise<never> {
  await requireRole("admin");
  const outcome = await adminRemoveDeck(await createSessionClient(), field(form, "deck"));
  back(field(form, "member"), `done=deck-${outcome}`);
}

async function target(form: FormData): Promise<Profile> {
  const viewer = await requireRole("admin");
  const id = field(form, "member");
  const member = id === "" ? null : await getProfile(await createSessionClient(), id);
  if (member === null) redirect("/admin/users?error=missing");

  const check = checkModeration(viewer.profile, member);
  if (!check.ok) back(member.id, `error=${check.problem}`);
  return member;
}

export async function changeBan(form: FormData): Promise<never> {
  const member = await target(form);
  const ban = form.get("ban") === "1";
  await setMemberBanned(await createSessionClient(), member.id, ban);
  back(member.id, `done=${ban ? "banned" : "unbanned"}`);
}

export async function removeEverything(form: FormData): Promise<never> {
  const member = await target(form);
  if (field(form, "confirm").trim() !== member.displayName) back(member.id, "error=confirm");

  const removed = await adminRemoveMemberContent(await createSessionClient(), member.id);
  back(
    member.id,
    `done=all&posts=${removed.posts}&deleted=${removed.decksDeleted}&hidden=${removed.decksHidden}`,
  );
}
