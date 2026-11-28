import type { ProfileId } from "@ps/contracts";
import { deletePushSubscription, listPushSubscriptions } from "@ps/db";
import webpush from "web-push";

import { createServiceRoleClient } from "@/lib/supabase/service-role.server";

/** What a notification says, and where tapping it goes. */
export interface PushMessage {
  readonly title: string;
  readonly body: string;
  /** A path in the play app. */
  readonly url: string;
  /** A later notification with the same tag replaces this one rather than stacking. */
  readonly tag: string;
}

/**
 * The VAPID key pair signs every push (E26.28): the public half is in the browser
 * bundle so a device can subscribe; the private half lives here, in a `.server.ts`
 * module, out of every client bundle (E1.7). Unset, nothing is sent and the play app
 * offers no notifications — which is every machine without the keys, and fine.
 */
function vapid(): { publicKey: string; privateKey: string; subject: string } | null {
  const publicKey = process.env["NEXT_PUBLIC_VAPID_PUBLIC_KEY"];
  const privateKey = process.env["VAPID_PRIVATE_KEY"];
  const subject = process.env["VAPID_SUBJECT"] ?? "mailto:hello@planarstandard.com";
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}

export function isPushConfigured(): boolean {
  return vapid() !== null;
}

/**
 * Sends `message` to every device of these members. A device the push service says is
 * gone (404, 410) is forgotten; any other failure is logged and skipped, because a
 * notification is a courtesy and never the reason a pairing or a result fails.
 */
export async function sendPush(
  profileIds: readonly ProfileId[],
  message: PushMessage,
): Promise<number> {
  const keys = vapid();
  if (keys === null || profileIds.length === 0) return 0;

  const service = createServiceRoleClient();
  const subscriptions = await listPushSubscriptions(service, profileIds);
  const payload = JSON.stringify(message);
  let sent = 0;

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          payload,
          { vapidDetails: keys, TTL: 60 * 60, urgency: "high", topic: message.tag.slice(0, 32) },
        );
        sent += 1;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await deletePushSubscription(service, subscription.endpoint);
        } else {
          console.error("push failed:", status, (error as Error).message);
        }
      }
    }),
  );
  return sent;
}
