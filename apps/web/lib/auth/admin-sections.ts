import type { UserRole } from "@ps/contracts";

/**
 * What lives on the admin page, and who each part is for (E20.21).
 *
 * The admin page's counterpart to `dashboard-sections.ts`, and navigation in
 * the same sense: each page still calls `requireRole` itself. A section may
 * live elsewhere — the review queue is open to writers, so it sits in the
 * dashboard and is listed here too, because an admin's list of what needs
 * attention would be wrong without it. Add a section by adding a row.
 */
export interface AdminSection {
  readonly href: string;
  readonly label: string;
  readonly description: string;
  readonly role: UserRole;
}

export const ADMIN_SECTIONS: readonly AdminSection[] = [
  {
    href: "/admin/users",
    label: "Users",
    description: "Grant roles and ban members.",
    role: "admin",
  },
  {
    href: "/admin/formats",
    label: "Formats",
    description: "Legal sets, deck limits and card rules for each version of the format.",
    role: "admin",
  },
  {
    href: "/admin/players",
    label: "Players",
    description: "Merge handles that belong to one person, and undo a merge.",
    role: "admin",
  },
  {
    href: "/admin/seasons",
    label: "Seasons",
    description: "Open and close seasons. The leaderboard rates the current one.",
    role: "admin",
  },
  {
    href: "/admin/processing",
    label: "Tournament processing",
    description:
      "Finished tournaments waiting to be processed — run them now, or re-run everything.",
    role: "admin",
  },
  {
    href: "/dashboard/review",
    label: "Community review",
    description: "Members' submissions waiting for a writer or above to approve them.",
    role: "writer",
  },
];
