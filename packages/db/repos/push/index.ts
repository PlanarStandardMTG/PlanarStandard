import type { ProfileId, PushSubscriptionRecord } from "@ps/contracts";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Reads and writes over `push_subscriptions` (E26.28). A member saves and removes
 * their own devices under their own client; sending reads everyone's as service-role.
 */

interface SubscriptionRow {
  readonly profile_id: string;
  readonly endpoint: string;
  readonly p256dh: string;
  readonly auth: string;
}

const COLUMNS = "profile_id, endpoint, p256dh, auth";

const toRecord = (row: SubscriptionRow): PushSubscriptionRecord => ({
  profileId: row.profile_id as ProfileId,
  endpoint: row.endpoint,
  p256dh: row.p256dh,
  auth: row.auth,
});

/** Saves the caller's device. Saving it again — a browser re-subscribing — is a no-op. */
export async function savePushSubscription(
  client: SupabaseClient,
  subscription: PushSubscriptionRecord,
  userAgent: string | null,
): Promise<void> {
  const { error } = await client.from("push_subscriptions").upsert(
    {
      profile_id: subscription.profileId,
      endpoint: subscription.endpoint,
      p256dh: subscription.p256dh,
      auth: subscription.auth,
      user_agent: userAgent,
    },
    { onConflict: "endpoint", ignoreDuplicates: true },
  );
  if (error !== null) throw new Error(`savePushSubscription failed: ${error.message}`);
}

/** Removes a device: the caller turning notifications off, or the server pruning a dead one. */
export async function deletePushSubscription(
  client: SupabaseClient,
  endpoint: string,
): Promise<void> {
  const { error } = await client.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error !== null) throw new Error(`deletePushSubscription failed: ${error.message}`);
}

/** Every device of these members. Service-role: a member reads only their own. */
export async function listPushSubscriptions(
  serviceClient: SupabaseClient,
  profileIds: readonly ProfileId[],
): Promise<readonly PushSubscriptionRecord[]> {
  if (profileIds.length === 0) return [];
  const { data, error } = await serviceClient
    .from("push_subscriptions")
    .select(COLUMNS)
    .in("profile_id", [...new Set(profileIds)]);
  if (error !== null) throw new Error(`listPushSubscriptions failed: ${error.message}`);
  return (data as unknown as SubscriptionRow[]).map(toRecord);
}

/** Whether the caller has any device subscribed — what the "Allow notifications" button shows. */
export async function hasPushSubscription(
  client: SupabaseClient,
  profileId: ProfileId,
): Promise<boolean> {
  const { count, error } = await client
    .from("push_subscriptions")
    .select("endpoint", { count: "exact", head: true })
    .eq("profile_id", profileId);
  if (error !== null) throw new Error(`hasPushSubscription failed: ${error.message}`);
  return (count ?? 0) > 0;
}
