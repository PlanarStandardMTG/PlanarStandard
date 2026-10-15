"use client";

import { useEffect, useState } from "react";

import { removeSubscriptionAction, saveSubscriptionAction } from "@/app/play/push-actions";
import { useHydrated } from "@/components/ui/hydrated";

import { SECONDARY } from "./button";

type Status = "unsupported" | "install-first" | "denied" | "off" | "on" | "working";

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = (value + "=".repeat((4 - (value.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function initialStatus(): Status {
  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    // iOS has no push until the app is on the Home Screen (16.4+).
    return /iphone|ipad|ipod/i.test(navigator.userAgent) ? "install-first" : "unsupported";
  }
  if (Notification.permission === "denied") return "denied";
  return "off";
}

/**
 * Turns on notifications for this device (E26.28): a new pairing, a result waiting for
 * you to confirm, the organizer chasing a missing one. Asked for only on a tap, which
 * is what iOS requires and what everyone else prefers.
 */
export function NotificationsButton({ publicKey }: { publicKey: string }) {
  const hydrated = useHydrated();
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    const first = initialStatus();
    if (first !== "off") {
      setStatus(first);
      return;
    }
    void navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((existing) => setStatus(existing === null ? "off" : "on"));
  }, []);

  if (!hydrated || status === null || status === "unsupported") return null;

  if (status === "install-first") {
    return (
      <p className="text-xs text-ink-500 dark:text-ink-400">
        Add to Home Screen to get notifications.
      </p>
    );
  }
  if (status === "denied") {
    return (
      <p className="text-xs text-ink-500 dark:text-ink-400">
        Notifications are blocked in your browser settings.
      </p>
    );
  }

  const turnOn = async () => {
    setStatus("working");
    try {
      if ((await Notification.requestPermission()) !== "granted") {
        setStatus(Notification.permission === "denied" ? "denied" : "off");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToBytes(publicKey),
      });
      setStatus((await saveSubscriptionAction(subscription.toJSON())) ? "on" : "off");
    } catch {
      setStatus("off");
    }
  };

  const turnOff = async () => {
    setStatus("working");
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription !== null) {
      await removeSubscriptionAction(subscription.endpoint);
      await subscription.unsubscribe();
    }
    setStatus("off");
  };

  return status === "on" ? (
    <p className="flex items-center gap-3 text-xs text-ink-500 dark:text-ink-400">
      Notifications on.
      <button type="button" onClick={() => void turnOff()} className="underline">
        Turn off
      </button>
    </p>
  ) : (
    <button
      type="button"
      onClick={() => void turnOn()}
      disabled={status === "working"}
      className={SECONDARY}
    >
      Allow notifications
    </button>
  );
}
