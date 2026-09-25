import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const processCompletedEvents = vi.fn(async () => ({ claimed: 2, processed: 2, failed: [] }));
vi.mock("@/lib/events/process-completions.server", () => ({ processCompletedEvents }));

const { GET, POST } = await import("./route");

const request = (authorization?: string) =>
  new Request("https://site.test/api/jobs/process-completed-events", {
    headers: authorization === undefined ? {} : { authorization },
  });

beforeEach(() => vi.stubEnv("CRON_SECRET", "s3cret"));
afterEach(() => {
  vi.unstubAllEnvs();
  processCompletedEvents.mockClear();
});

describe("/api/jobs/process-completed-events", () => {
  it("works the queue for the secret, on GET or POST, and reports", async () => {
    const got = await GET(request("Bearer s3cret"));
    expect(got.status).toBe(200);
    expect(await got.json()).toEqual({ claimed: 2, processed: 2, failed: [] });

    expect((await POST(request("Bearer s3cret"))).status).toBe(200);
    expect(processCompletedEvents).toHaveBeenCalledTimes(2);
  });

  it("refuses without the secret, and runs nothing", async () => {
    expect((await GET(request())).status).toBe(401);
    expect((await GET(request("Bearer wrong"))).status).toBe(401);
    expect(processCompletedEvents).not.toHaveBeenCalled();
  });

  it("refuses everyone when no secret is configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(request("Bearer "))).status).toBe(503);
    expect(processCompletedEvents).not.toHaveBeenCalled();
  });
});
