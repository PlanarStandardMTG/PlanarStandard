import { ROLE_LADDER } from "@ps/core";
import { listMembers } from "@ps/db";
import type { Metadata } from "next";

import { Notice } from "@/components/auth/form-parts";
import { Badge } from "@/components/ui/badge";
import { requireRole } from "@/lib/auth/guard";
import { formatDate } from "@/lib/format-date";
import { createSessionClient } from "@/lib/supabase/session";

import { changeMemberBan, changeMemberRole } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Users",
  robots: { index: false, follow: false },
};

const DONE: Readonly<Record<string, string>> = {
  role: "Role changed.",
  banned: "Member banned. They keep their account and data, and can do nothing a role grants.",
  unbanned: "Ban lifted.",
};

const ERRORS: Readonly<Record<string, string>> = {
  missing: "That member no longer exists.",
  self: "You cannot change your own role or ban yourself — ask another admin.",
  erased: "That account has been deleted.",
  role: "That is not a role.",
  "not-admin": "Only an admin can do that.",
};

const SMALL_BUTTON =
  "cursor-pointer whitespace-nowrap rounded-md border border-ink-300 px-2.5 py-1 text-xs font-medium hover:bg-ink-100 dark:border-ink-700 dark:hover:bg-ink-900";

/** Every member, their role, and whether they are banned (E20.21). */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await requireRole("admin");
  const { done, error } = await searchParams;

  const members = await listMembers(await createSessionClient());

  return (
    <>
      <header className="mb-8">
        <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">Users</h1>
        <p className="mt-2 max-w-prose text-ink-600 dark:text-ink-400">
          Roles are a ladder — each one can do everything the ones below it can. A ban takes every
          rung away without deleting anything.
        </p>
      </header>

      {typeof done === "string" && DONE[done] !== undefined && (
        <Notice tone="good">{DONE[done]}</Notice>
      )}
      {typeof error === "string" && ERRORS[error] !== undefined && (
        <Notice tone="warn">{ERRORS[error]}</Notice>
      )}

      <div className="mt-6 overflow-x-auto rounded-lg border border-ink-200 dark:border-ink-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-200 bg-ink-50 text-xs tracking-wide text-ink-500 uppercase dark:border-ink-800 dark:bg-ink-900 dark:text-ink-400">
            <tr>
              <th className="px-4 py-2 font-semibold">Member</th>
              <th className="px-4 py-2 font-semibold">Role</th>
              <th className="px-4 py-2 font-semibold">Standing</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-200 dark:divide-ink-800">
            {members.map((member) => {
              const self = member.id === viewer.profile.id;
              return (
                <tr key={member.id} className="align-middle">
                  <td className="px-4 py-3">
                    <p className="font-medium">
                      {member.displayName}
                      {self && <span className="ml-2 text-xs text-ink-500">(you)</span>}
                    </p>
                    <p className="text-xs text-ink-500 dark:text-ink-400">
                      {member.handle === null ? "no handle" : `@${member.handle}`} · joined{" "}
                      {formatDate(member.createdAt)}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {self ? (
                      <Badge>{member.role}</Badge>
                    ) : (
                      <form action={changeMemberRole} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={member.id} />
                        <label className="sr-only" htmlFor={`role-${member.id}`}>
                          Role for {member.displayName}
                        </label>
                        <select
                          id={`role-${member.id}`}
                          name="role"
                          defaultValue={member.role}
                          className="rounded-md border border-ink-300 bg-paper px-2 py-1 text-sm dark:border-ink-700 dark:bg-ink-950"
                        >
                          {ROLE_LADDER.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                        <button type="submit" className={SMALL_BUTTON}>
                          Save
                        </button>
                      </form>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {member.bannedAt === null ? (
                        <span className="text-ink-500 dark:text-ink-400">Active</span>
                      ) : (
                        <span className="whitespace-nowrap text-red-700 dark:text-red-400">
                          Banned {formatDate(member.bannedAt)}
                        </span>
                      )}
                      {!self && (
                        <form action={changeMemberBan}>
                          <input type="hidden" name="id" value={member.id} />
                          <input
                            type="hidden"
                            name="ban"
                            value={member.bannedAt === null ? "1" : "0"}
                          />
                          <button type="submit" className={SMALL_BUTTON}>
                            {member.bannedAt === null ? "Ban" : "Lift ban"}
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
