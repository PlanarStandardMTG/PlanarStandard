"use server";

import { deletePushSubscription, savePushSubscription } from "@ps/db";
import { headers } from "next/headers";

import { requireRole } from "@/lib/auth/guard";
import { createSessionClient } from "@/lib/supabase/session";

/** What `PushSubscription.toJSON()` gives the browser. */
export interface BrowserSubscription {
  readonly endpoint?: string;
  readonly keys?: { readonly p256dh?: string; readonly auth?: string };
}

/** Saves the device the member just allowed notifications on (E26.28). */
export async function saveSubscriptionAction(subscription: BrowserSubscription): Promise<boolean> {
  const viewer = await requireRole("reader");
  const { endpoint, keys } = subscription;
  if (!endpoint?.startsWith("https://") || !keys?.p256dh || !keys.auth) return false;
  await savePushSubscription(
    await createSessionClient(),
    { profileId: viewer.profile.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    (await headers()).get("user-agent"),
  );
  return true;
}

/** Forgets a device, when the member turns notifications off on it. */
export async function removeSubscriptionAction(endpoint: string): Promise<void> {
  await requireRole("reader");
  await deletePushSubscription(await createSessionClient(), endpoint);
}
