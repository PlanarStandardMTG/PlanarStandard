import { canRemoveContent } from "@ps/core";
import { getPlayer, getPlayerBySlug, listIdentitiesByPlayer, listPlayedEntries } from "@ps/db";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { PlayedEvents } from "@/components/ui/played-events";
import { requireRole } from "@/lib/auth/guard";
import { isUuid } from "@/lib/people/member-href";
import { createSessionClient } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Unclaimed handle",
  robots: { index: false, follow: false },
};

/**
 * Where a player's name leads (E20.42). A claimed player is a member, so this
 * sends the viewer on to their history; an unclaimed one gets this page, which
 * says so and lists what the ledger has on the handle.
 */
export default async function PlayerHandlePage({ params }: { params: Promise<{ key: string }> }) {
  const viewer = await requireRole("writer");
  const key = decodeURIComponent((await params).key);
  const session = await createSessionClient();

  const player = isUuid(key) ? await getPlayer(session, key) : await getPlayerBySlug(session, key);
  if (player === null) notFound();
  if (player.profileId !== null) redirect(`/members/${player.profileId}`);

  const [handles, played] = await Promise.all([
    listIdentitiesByPlayer(session, player.id),
    listPlayedEntries(session, { playerId: player.id }),
  ]);

  return (
    <div className="flex-1">
      <Container className="py-12">
        <PageHeader kicker="Unclaimed handle" title={player.displayName}>
          Nobody has claimed this handle, so it belongs to no member and has no history beyond its
          results.
        </PageHeader>

        {canRemoveContent(viewer.profile) && (
          <p className="text-sm text-ink-600 dark:text-ink-400">
            If you know whose it is, link it to their account on{" "}
            <Link
              href="/admin/players"
              className="text-eclipse-700 hover:underline dark:text-eclipse-400"
            >
              Players
            </Link>
            .
          </p>
        )}

        {handles.length > 0 && (
          <p className="mt-6 text-sm text-ink-600 dark:text-ink-400">
            Seen as{" "}
            {handles.map((h, i) => (
              <span key={h.id}>
                {i > 0 && ", "}
                <span className="font-medium text-ink-800 dark:text-ink-200">
                  {h.handle.raw}
                </span>{" "}
                on {h.handle.platform}
              </span>
            ))}
            .
          </p>
        )}

        <section className="mt-10">
          <h2 className="mb-3 font-display text-2xl tracking-tight">
            Events <span className="text-ink-500 dark:text-ink-400">{played.length}</span>
          </h2>
          {played.length === 0 ? (
            <p className="text-sm text-ink-500 dark:text-ink-400">No results under this handle.</p>
          ) : (
            <PlayedEvents entries={played} />
          )}
        </section>
      </Container>
    </div>
  );
}
