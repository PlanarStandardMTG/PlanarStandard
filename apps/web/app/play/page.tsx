import { listLiveRuns } from "@ps/db";
import type { Metadata } from "next";
import Link from "next/link";

import { InstallPrompt } from "@/components/play/install-prompt";
import { LocalTime } from "@/components/ui/local-time";
import { createSessionClient } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Play" };

const STATE_LABEL = {
  registration: "Registration open",
  running: "Playing",
  top_cut: "Top cut",
} as const;

/** The play app's home: events open for registration or being played (E26.23). */
export default async function PlayHome() {
  const runs = await listLiveRuns(await createSessionClient());

  return (
    <div className="space-y-6">
      <InstallPrompt />
      <section>
        <h1 className="font-display text-3xl tracking-tight">Events</h1>
        {runs.length === 0 ? (
          <p className="mt-3 text-sm text-ink-600 dark:text-ink-400">
            Nothing is open or being played right now. Events run on the site appear here once their
            organizer opens registration.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-ink-200 rounded-xl border border-ink-200 dark:divide-ink-800 dark:border-ink-800">
            {runs.map((run) => (
              <li key={run.id}>
                <Link
                  href={`/play/runs/${run.id}`}
                  className="block px-4 py-3 hover:bg-ink-50 dark:hover:bg-ink-900"
                >
                  <p className="font-medium">{run.name}</p>
                  <p className="text-xs text-ink-500 dark:text-ink-400">
                    {STATE_LABEL[run.state as keyof typeof STATE_LABEL] ?? run.state}
                    {run.startsAt !== null && (
                      <>
                        {" · "}
                        <LocalTime iso={run.startsAt} />
                      </>
                    )}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
