// Server-only: names the key, and is a `*.server.ts` module, so this file is fine.
export const secret = process.env["SUPABASE_SERVICE_ROLE_KEY"];
