import { processCompletedEvents } from "@/lib/events/process-completions.server";
import { authorizeJob } from "@/lib/jobs/authorize.server";

/**
 * Work the queue of finished tournaments (E23.13), for whichever scheduler is
 * pointed at it. Vercel Cron calls a GET; `curl -X POST` from anywhere else does
 * the same thing. Both need `Authorization: Bearer $CRON_SECRET`.
 *
 * The queue decides what is due and guarantees each event is handled once, so
 * calling this too often costs nothing, and two schedulers overlapping is safe.
 */
export const maxDuration = 300;

export async function GET(request: Request): Promise<Response> {
  return await run(request);
}

export async function POST(request: Request): Promise<Response> {
  return await run(request);
}

async function run(request: Request): Promise<Response> {
  const authorized = authorizeJob(request.headers.get("authorization"));
  if (authorized === "not-configured") {
    return json({ error: "CRON_SECRET is not set, so no job may run here." }, 503);
  }
  if (authorized === "unauthorized") return json({ error: "unauthorized" }, 401);

  return json(await processCompletedEvents(), 200);
}

function json(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
