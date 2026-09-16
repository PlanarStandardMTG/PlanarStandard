import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The public client, for everything a visitor is allowed to read.
 *
 * Uses the anon key, so every query is subject to RLS — the policies are the
 * access rule, not a filter a caller could forget. Anything needing to write, or
 * to read past a policy, goes through `service-role.server.ts` instead.
 */
export function createPublicClient(): SupabaseClient {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const anonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];

  if (url === undefined || anonKey === undefined) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set. " +
        "Run `pnpm db:start` and copy apps/web/.env.example to apps/web/.env.local.",
    );
  }

  return createClient(url, anonKey, { auth: { persistSession: false } });
}
