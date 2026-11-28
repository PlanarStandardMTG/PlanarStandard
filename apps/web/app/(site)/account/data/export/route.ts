import { requireViewer } from "@/lib/auth/guard";
import { personalDataExport } from "@/lib/account/personal-data.server";

/**
 * Download everything we hold about you (E16.11).
 *
 * A GET, unlike every other route under `app/auth/`: this changes nothing, and a
 * plain link that downloads a file is the least surprising way to offer it. The
 * guard runs first, and the subject is the session rather than anything in the
 * URL, so there is no id here to change to somebody else's.
 */
export async function GET(): Promise<Response> {
  const viewer = await requireViewer();
  const data = await personalDataExport(viewer);

  const name = viewer.profile.handle ?? "account";
  const stamp = data.exportedAt.slice(0, 10);

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="planar-standard-${name}-${stamp}.json"`,
      // Somebody's personal data should not sit in a shared cache on the way.
      "Cache-Control": "no-store, private",
    },
  });
}
