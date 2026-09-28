import type { UserRole } from "@ps/contracts";

/**
 * What the dashboard lists, in order, and who each part is for (E16.6, E20.47).
 *
 * This table is for **navigation**, not for access. It decides what a person is
 * shown a link to; each page still calls `requireRole` itself, and RLS still
 * decides what any of them can write. Hiding a link is a courtesy, and a
 * courtesy is not a control.
 */
export interface DashboardSection {
  readonly href: string;
  readonly label: string;
  readonly description: string;
  readonly role: UserRole;
}

export const DASHBOARD_SECTIONS: readonly DashboardSection[] = [
  {
    href: "/dashboard/profile",
    label: "Profile",
    description: "Your display name, handle and bio.",
    role: "reader",
  },
  {
    // The decks page's own tab, until the dashboard has one.
    href: "/decks?view=mine",
    label: "Decks",
    description: "The decks you have saved, and a way to save more.",
    role: "reader",
  },
  {
    href: "/dashboard/community",
    label: "Community posts",
    description: "Write, edit and delete your community posts.",
    role: "reader",
  },
  {
    // Admins only, as `canWriteKind` and `posts_author_insert` say.
    href: "/dashboard/news",
    label: "News posts",
    description: "Write, edit and delete your news posts.",
    role: "admin",
  },
  {
    href: "/dashboard/review",
    label: "Review queue",
    description: "Approve members' submissions for publication, or send them back.",
    role: "writer",
  },
  {
    href: "/admin",
    label: "Admin dashboard",
    description: "Users, formats, players, seasons, event fetching and data processing.",
    role: "admin",
  },
];

/**
 * The lowest rung with anything to do here; the index guards at this. Every
 * member since E20.22, because anyone may write a community post.
 */
export const DASHBOARD_MINIMUM: UserRole = "reader";
