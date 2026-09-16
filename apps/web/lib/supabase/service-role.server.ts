import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The service-role client. Bypasses RLS entirely.
 *
 * `.server.ts` is load-bearing: `scripts/check-server-only.ts` (E1.7) fails CI if
 * anything reachable from a `'use client'` module imports this file, and only a
 * server-only module may name the key at all.
 */
export function createServiceRoleClient(): SupabaseClient {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const secret = process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (url === undefined || secret === undefined) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  }

  return createClient(url, secret, { auth: { persistSession: false } });
}
