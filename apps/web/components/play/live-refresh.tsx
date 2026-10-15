"use client";

import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Changes within this long of each other refresh once: a round's pairings arrive together. */
const SETTLE_MS = 400;

/**
 * Keeps a run's page current while it is open (E26.26): any change to the run, its
 * entrants, rounds or pairings re-renders the page from the server. Anonymous on
 * purpose — the run tables a page shows are public once the run is, and Realtime
 * applies the same read policies (0053) — so this needs no session in the browser
 * and holds no key but the public one.
 */
export function LiveRefresh({ runId }: { runId: string }) {
  const router = useRouter();

  useEffect(() => {
    const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
    const anonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
    if (url === undefined || anonKey === undefined) return;

    const client = createClient(url, anonKey, { auth: { persistSession: false } });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), SETTLE_MS);
    };

    const channel = client.channel(`run:${runId}`);
    for (const table of ["run_entrants", "run_rounds", "run_pairings"]) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `run_id=eq.${runId}` },
        refresh,
      );
    }
    channel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournament_runs", filter: `id=eq.${runId}` },
        refresh,
      )
      .subscribe();

    return () => {
      clearTimeout(timer);
      void client.removeChannel(channel);
    };
  }, [runId, router]);

  return null;
}
