/**
 * A thrown fetch error, reduced to a fixed phrase that is safe to store.
 *
 * Never the message: a `SyntaxError` from `response.json()` quotes the start of
 * the body it could not parse, and a third party's body can carry personal data.
 */
export function describeFetchFailure(cause: unknown): string {
  if (!(cause instanceof Error)) return "unknown error";
  switch (cause.name) {
    case "TimeoutError":
      return "timed out";
    case "SyntaxError":
      return "response was not JSON";
    // What undici throws for DNS, refused connections and resets; the detail is on `.cause`.
    case "TypeError":
      return "fetch failed";
    default:
      return cause.name;
  }
}
