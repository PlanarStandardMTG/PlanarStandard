"use client";

import { useEffect } from "react";

/** Registers `/play-sw.js` for the play app, quietly: a browser without workers still works. */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/play-sw.js", { scope: "/play", updateViaCache: "none" })
      .catch(() => {});
  }, []);
  return null;
}
