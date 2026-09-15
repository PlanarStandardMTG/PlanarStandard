// Reachable from a client component below — that is the violation.
import { serviceRoleKey } from "./server-only/supabase.server";

export function loadRatings(): string {
  return serviceRoleKey();
}
