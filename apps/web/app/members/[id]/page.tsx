import type { Deck, PostWithAuthor, Profile } from "@ps/contracts";
import { canRemoveContent, latestVersions } from "@ps/core";
import {
  getPlayerByProfile,
  getProfile,
  listMemberDecks,
  listPlayedEntries,
  listPostsByAuthor,
} from "@ps/db";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { Notice } from "@/components/auth/form-parts";
import { RemoveEverythingButton } from "@/components/members/remove-everything-button";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { PlayedEvents } from "@/components/ui/played-events";
import { requireRole } from "@/lib/auth/guard";
import { formatDate } from "@/lib/format-date";
import { isUuid } from "@/lib/people/member-href";
import { postHref } from "@/lib/post-url";
import { createSessionClient } from "@/lib/supabase/session";

import { changeBan, deleteMemberPost, removeEverything, removeMemberDeck } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Member history",
  robots: { index: false, follow: false },
};

const DONE: Readonly<Record<string, string>> = {
  post: "Post deleted.",
  "deck-deleted": "Deck deleted, every version.",
  "deck-hidden": "An event names this deck, so it is hidden rather than deleted.",
  banned: "Member banned. They keep their account and data, and can post nothing new.",
  unbanned: "Ban lifted.",
};

const ERRORS: Readonly<Record<string, string>> = {
  self: "You cannot ban yourself or remove your own things from here.",
  erased: "That account has been deleted.",
  "not-admin": "Only an admin can do that.",
  confirm: "The name did not match, so nothing was removed.",
};

const SMALL_BUTTON =
  "cursor-pointer whitespace-nowrap rounded-md border border-ink-300 px-2.5 py-1 text-xs font-medium hover:bg-ink-100 dark:border-ink-700 dark:hover:bg-ink-900";

/**
 * Everything one member has made, for writers and up (E20.42): their posts,
 * saved decks and events. RLS decides how much — a writer sees what is public or
 * in review, an admin everything — and an admin can remove it or ban them.
 */
export default async function MemberHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await requireRole("writer");
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!isUuid(id)) notFound();
  const session = await createSessionClient();

  const member = await getProfile(session, id);
  if (member === null) notFound();

  const [posts, decks, player] = await Promise.all([
    listPostsByAuthor(session, member.id),
    listMemberDecks(session, member.id),
    getPlayerByProfile(session, member.id),
  ]);
  const played = player === null ? [] : await listPlayedEntries(session, { playerId: player.id });
  const saved = latestVersions(decks);

  const admin = canRemoveContent(viewer.profile);
  const self = member.id === viewer.profile.id;
  const erased = member.deletedAt !== null;

  return (
    <div className="flex-1">
      <Container className="py-12">
        <PageHeader
          kicker="Member history"
          title={member.displayName}
          aside={
            admin &&
            !self &&
            !erased && (
              <div className="flex flex-wrap items-center gap-2">
                <form action={changeBan}>
                  <input type="hidden" name="member" value={member.id} />
                  <input type="hidden" name="ban" value={member.bannedAt === null ? "1" : "0"} />
                  <button
                    type="submit"
                    className="cursor-pointer rounded-lg border border-ink-300 px-4 py-2 text-sm text-ink-700 hover:border-red-400 hover:text-red-700 dark:border-ink-700 dark:text-ink-300 dark:hover:text-red-400"
                  >
                    {member.bannedAt === null ? "Ban from posting" : "Lift ban"}
                  </button>
                </form>
                <RemoveEverythingButton
                  memberId={member.id}
                  name={member.displayName}
                  posts={posts.length}
                  decks={saved.length}
                  action={removeEverything}
                />
              </div>
            )
          }
        >
          <MemberLine member={member} />
        </PageHeader>

        {typeof query["done"] === "string" && (
          <Notice tone="good">
            {query["done"] === "all" ? removedLine(query) : (DONE[query["done"]] ?? "Done.")}
          </Notice>
        )}
        {typeof query["error"] === "string" && ERRORS[query["error"]] !== undefined && (
          <Notice tone="warn">{ERRORS[query["error"]]}</Notice>
        )}

        {!admin && (
          <p className="mt-6 text-sm text-ink-500 dark:text-ink-400">
            You see what is public or waiting for review. Admins also see drafts and private decks.
          </p>
        )}

        <Section title="Posts" count={posts.length} empty="No posts.">
          {posts.map((post) => (
            <Row
              key={post.id}
              main={<PostTitle post={post} />}
              detail={`${post.kind === "official" ? "News" : "Community"} · ${formatDate(post.publishedAt ?? post.createdAt)}`}
              badge={post.status === "published" ? null : post.status}
              remove={
                admin && (
                  <RemoveForm
                    action={deleteMemberPost}
                    member={member.id}
                    name="post"
                    value={post.id}
                    label="Delete post"
                  />
                )
              }
            />
          ))}
        </Section>

        <Section title="Saved decks" count={saved.length} empty="No saved decks.">
          {saved.map(({ deck, versions }) => (
            <Row
              key={deck.id}
              main={
                <Link href={`/decks/${deck.id}`} className="font-medium hover:underline">
                  {deck.name}
                </Link>
              }
              detail={deckDetail(deck, versions)}
              badge={deck.visibility === "public" ? null : deck.visibility}
              remove={
                admin && (
                  <RemoveForm
                    action={removeMemberDeck}
                    member={member.id}
                    name="deck"
                    value={deck.id}
                    label="Delete deck"
                  />
                )
              }
            />
          ))}
        </Section>

        <section className="mt-10">
          <h2 className="mb-3 font-display text-2xl tracking-tight">
            Events <span className="text-ink-500 dark:text-ink-400">{played.length}</span>
          </h2>
          {player === null ? (
            <p className="text-sm text-ink-500 dark:text-ink-400">
              Not linked to a player, so no results are theirs yet.
            </p>
          ) : played.length === 0 ? (
            <p className="text-sm text-ink-500 dark:text-ink-400">
              Linked to {player.displayName}, who has no results yet.
            </p>
          ) : (
            <PlayedEvents entries={played} />
          )}
        </section>
      </Container>
    </div>
  );
}

function MemberLine({ member }: { member: Profile }) {
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-2 text-base">
      <span>{member.handle === null ? "No handle" : `@${member.handle}`}</span>
      <Badge className="capitalize">{member.role}</Badge>
      <span>joined {formatDate(member.createdAt)}</span>
      {member.bannedAt !== null && (
        <span className="text-red-700 dark:text-red-400">Banned {formatDate(member.bannedAt)}</span>
      )}
      {member.deletedAt !== null && <span>Account deleted</span>}
    </span>
  );
}

function PostTitle({ post }: { post: PostWithAuthor }) {
  return post.status === "published" ? (
    <Link href={postHref(post)} className="font-medium hover:underline">
      {post.title}
    </Link>
  ) : (
    <span className="font-medium">{post.title}</span>
  );
}

function deckDetail(deck: Deck, versions: number): string {
  const when = formatDate(deck.createdAt);
  return versions > 1 ? `${versions} versions · ${when}` : when;
}

function removedLine(query: Record<string, string | string[] | undefined>): string {
  const n = (key: string) => Number(query[key] ?? 0);
  const hidden = n("hidden") > 0 ? `, and ${n("hidden")} hidden because an event names them` : "";
  return `Removed ${n("posts")} posts and deleted ${n("deleted")} deck versions${hidden}.`;
}

function Section({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 font-display text-2xl tracking-tight">
        {title} <span className="text-ink-500 dark:text-ink-400">{count}</span>
      </h2>
      {count === 0 ? (
        <p className="text-sm text-ink-500 dark:text-ink-400">{empty}</p>
      ) : (
        <ul className="divide-y divide-ink-200 rounded-lg border border-ink-200 dark:divide-ink-800 dark:border-ink-800">
          {children}
        </ul>
      )}
    </section>
  );
}

function Row({
  main,
  detail,
  badge,
  remove,
}: {
  main: ReactNode;
  detail: string;
  badge: string | null;
  remove: ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        {main}
        <span className="block text-xs text-ink-500 dark:text-ink-400">{detail}</span>
      </div>
      <div className="flex items-center gap-3">
        {badge !== null && (
          <Badge variant="outline" className="capitalize">
            {badge}
          </Badge>
        )}
        {remove}
      </div>
    </li>
  );
}

/** A second click to confirm, with no script: the button is inside a `<details>`. */
function RemoveForm({
  action,
  member,
  name,
  value,
  label,
}: {
  action: (form: FormData) => Promise<void>;
  member: string;
  name: string;
  value: string;
  label: string;
}) {
  return (
    <details className="group relative">
      <summary
        className={`${SMALL_BUTTON} list-none group-open:bg-ink-100 dark:group-open:bg-ink-900`}
      >
        Delete
      </summary>
      <form action={action} className="absolute right-0 z-10 mt-1">
        <input type="hidden" name="member" value={member} />
        <input type="hidden" name={name} value={value} />
        <button
          type="submit"
          className="cursor-pointer whitespace-nowrap rounded-md bg-red-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-600"
        >
          {label}
        </button>
      </form>
    </details>
  );
}
