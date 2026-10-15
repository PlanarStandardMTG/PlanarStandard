import { listLiveRuns, listRunsByOrganizer, listRunsEnteredBy } from "@ps/db";
import type { Metadata } from "next";
import Link from "next/link";

import { PRIMARY } from "@/components/play/button";
import { InstallPrompt } from "@/components/play/install-prompt";
import { NotificationsButton } from "@/components/play/notifications-button";
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
  const vapidKey = process.env["NEXT_PUBLIC_VAPID_PUBLIC_KEY"] || undefined;
  const organizes =
    viewer !== null &&
    ["organizer", "admin"].includes(viewer.profile.role) &&
    viewer.profile.bannedAt === null;
  const [runs, mine, entered] = await Promise.all([
    listLiveRuns(client),
    organizes ? listRunsByOrganizer(client, viewer.profile.id) : Promise.resolve([]),
    viewer === null ? Promise.resolve([]) : listRunsEnteredBy(client, viewer.profile.id),
  ]);

  return (
    <div className="space-y-6">
      <InstallPrompt />
      {entered.length > 0 && (
        <section>
          <h2 className="font-display text-xl">You are playing</h2>
          {vapidKey !== undefined && (
            <div className="mt-2">
              <NotificationsButton publicKey={vapidKey} />
            </div>
          )}
          <ul className="mt-3 space-y-2">
            {entered.map((run) => (
              <li key={run.id}>
                <Link
                  href={`/play/events/${run.id}`}
                  className="block rounded-xl border-2 border-gold-500/50 px-4 py-3 hover:bg-ink-50 dark:hover:bg-ink-900"
                >
                  <p className="font-medium">{run.name}</p>
                  <p className="text-xs text-ink-500 dark:text-ink-400">{STATE_LABEL[run.state]}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h1 className="font-display text-3xl tracking-tight">Events</h1>
        {runs.length === 0 ? (
          <p className="mt-3 text-sm text-ink-600 dark:text-ink-400">No events right now.</p>
        ) : (
          <ul className="mt-4 divide-y divide-ink-200 rounded-xl border border-ink-200 dark:divide-ink-800 dark:border-ink-800">
            {runs.map((run) => (
              <li key={run.id}>
                <Link
                  href={`/play/events/${run.id}`}
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
            <h2 className="font-display text-xl">Your events</h2>
            <Link href="/play/events/new" className={PRIMARY}>
              New event
            </Link>
          </div>
          {mine.length === 0 ? (
            <p className="mt-2 text-sm text-ink-600 dark:text-ink-400">None yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-ink-200 rounded-xl border border-ink-200 dark:divide-ink-800 dark:border-ink-800">
              {mine.map((run) => (
                <li key={run.id}>
                  <Link
                    href={`/play/events/${run.id}`}
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
