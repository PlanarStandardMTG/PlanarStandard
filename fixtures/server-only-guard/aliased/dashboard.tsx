"use client";

// The violation: a client component reaching a server-only module through the
// `@/` alias rather than a relative path.
import { secret } from "@/lib/supabase.server";

export const Dashboard = () => secret;
