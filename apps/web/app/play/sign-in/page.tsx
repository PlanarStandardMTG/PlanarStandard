import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CodeSignIn } from "@/components/play/code-sign-in";
import { safeNextPath } from "@/lib/auth/next-path";
import { currentViewer } from "@/lib/auth/viewer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

/** Signing in inside the play app, with a code rather than a link (E26.24). */
export default async function PlaySignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = (await searchParams)["next"];
  const next = safeNextPath(typeof raw === "string" && raw.startsWith("/play") ? raw : "/play");
  if ((await currentViewer()) !== null) redirect(next);

  return (
    <div className="mx-auto w-full max-w-sm">
      <h1 className="mb-6 font-display text-3xl tracking-tight">Sign in</h1>
      <CodeSignIn next={next} />
    </div>
  );
}
