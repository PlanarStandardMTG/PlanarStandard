import { listLiveRuns, listRunsByOrganizer } from "@ps/db";
import type { Metadata } from "next";
import Link from "next/link";

import { PRIMARY } from "@/components/play/button";
import { InstallPrompt } from "@/components/play/install-prompt";
import { STATE_LABEL } from "@/components/play/run-messages";
import { LocalTime } from "@/components/ui/local-time";
import { currentViewer } from "@/lib/auth/viewer";
import { createSessionClient } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Play" };

/** The play app's home: events open for registration or being played (E26.23). */
export default async function PlayHome() {
  const client = await createSessionClient();
  const viewer = await currentViewer();
  const organizes =
    viewer !== null &&
    ["organizer", "admin"].includes(viewer.profile.role) &&
    viewer.profile.bannedAt === null;
  const [runs, mine] = await Promise.all([
    listLiveRuns(client),
    organizes ? listRunsByOrganizer(client, viewer.profile.id) : Promise.resolve([]),
  ]);

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
                    {STATE_LABEL[run.state] ?? run.state}
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

      {organizes && (
        <section>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl">Your runs</h2>
            <Link href="/play/runs/new" className={PRIMARY}>
              New run
            </Link>
          </div>
          {mine.length === 0 ? (
            <p className="mt-2 text-sm text-ink-600 dark:text-ink-400">
              None yet. A new run is a draft until you open registration.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-ink-200 rounded-xl border border-ink-200 dark:divide-ink-800 dark:border-ink-800">
              {mine.map((run) => (
                <li key={run.id}>
                  <Link
                    href={`/play/runs/${run.id}`}
                    className="flex justify-between px-4 py-3 text-sm hover:bg-ink-50 dark:hover:bg-ink-900"
                  >
                    <span className="font-medium">{run.name}</span>
                    <span className="text-ink-500 dark:text-ink-400">{STATE_LABEL[run.state]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
