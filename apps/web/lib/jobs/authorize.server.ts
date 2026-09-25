import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Whether a request may run a job (E23.13).
 *
 * A job route is public by URL, so the secret is the whole guard. It is
 * `CRON_SECRET` because Vercel Cron sends exactly `Authorization: Bearer
 * $CRON_SECRET` on its own; any other scheduler — a GitHub Actions `curl`, a
 * person — sends the same header. Unset, every job refuses: a deployment that
 * never configured a scheduler has no business being run by one.
 *
 * Digests are compared rather than the strings, so neither the secret's
 * characters nor its length leak through how long a refusal takes.
 */
export type JobAuthorization = "ok" | "unauthorized" | "not-configured";

export function authorizeJob(
  authorization: string | null,
  secret: string | undefined = process.env["CRON_SECRET"],
): JobAuthorization {
  if (secret === undefined || secret === "") return "not-configured";
  if (authorization === null) return "unauthorized";

  return timingSafeEqual(digest(authorization), digest(`Bearer ${secret}`)) ? "ok" : "unauthorized";
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}
