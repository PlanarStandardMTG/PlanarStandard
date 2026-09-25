import type { UserRole } from "@ps/contracts";

/**
 * What lives behind the dashboard, and who each part is for (E16.6).
 *
 * This table is for **navigation**, not for access. It decides what a person is
 * shown a link to; each page still calls `requireRole` itself, and RLS still
 * decides what any of them can write. Three layers saying the same thing is the
 * point: hiding a link is a courtesy, and a courtesy is not a control.
 *
 * `built: false` entries are listed rather than hidden, the same way the main
 * nav lists `/meta` and `/leaderboard`. The shape of the dashboard is worth
 * advertising to the people who will use it.
 */
export interface DashboardSection {
  readonly href: string;
  readonly label: string;
  readonly description: string;
  readonly role: UserRole;
  readonly built: boolean;
  /** The backlog story that fills it in, so the nav says where to look. */
  readonly story: string;
}

export const DASHBOARD_SECTIONS: readonly DashboardSection[] = [
  {
    href: "/dashboard/community",
    label: "Community",
    description:
      "Write community posts. A writer's publish at once; anyone else's wait for review.",
    role: "reader",
    built: true,
    story: "E20.22",
  },
  {
    href: "/dashboard/review",
    label: "Review queue",
    description: "Approve members' submissions for publication, or send them back.",
    role: "writer",
    built: true,
    story: "E20.22",
  },
  {
    href: "/dashboard/tournaments",
    label: "Tournaments",
    description: "Create events and import results from any supported platform.",
    role: "organizer",
    built: false,
    story: "E20.15",
  },
  {
    href: "/dashboard/identities",
    label: "Identities",
    description: "Review suggested merges and bind handles to players.",
    role: "admin",
    built: false,
    story: "E20.16",
  },
  {
    href: "/dashboard/format",
    label: "Format",
    description: "Legal sets, bans, and exceptions — edited here, never in a deploy.",
    role: "admin",
    built: false,
    story: "E20.18",
  },
];

/**
 * The lowest rung with anything to do here. The layout guards at this. Every
 * member since E20.22, because anyone may write a community post.
 */
export const DASHBOARD_MINIMUM: UserRole = "reader";
