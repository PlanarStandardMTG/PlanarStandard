import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell, Card } from "@/components/auth/form-parts";
import { safeNextPath } from "@/lib/auth/next-path";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Check your email",
  robots: { index: false, follow: false },
};

/**
 * Where all three emailed flows land after sending (E16.9).
 *
 * Deliberately says "if there is an account" rather than "we sent it": the page
 * is reached whether or not the address exists, and wording that assumed it does
 * would undo the enumeration protection the routes were careful to keep.
 */
interface Reason {
  readonly title: string;
  readonly body: string;
}

const SIGN_IN_LINK: Reason = {
  title: "Check your email",
  body: "If that address has an account, a sign-in link is on its way. It expires in an hour and can only be used once.",
};

const REASONS: Readonly<Record<string, Reason>> = {
  confirm: {
    title: "Confirm your email",
    body: "We have sent a link to that address. Open it and your account is ready — it expires in an hour.",
  },
  link: SIGN_IN_LINK,
  recovery: {
    title: "Check your email",
    body: "If that address has an account, a link to choose a new password is on its way. It expires in an hour.",
  },
};

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawReason = typeof params["reason"] === "string" ? params["reason"] : null;
  const reason = (rawReason === null ? undefined : REASONS[rawReason]) ?? SIGN_IN_LINK;
  const next = safeNextPath(typeof params["next"] === "string" ? params["next"] : null);

  return (
    <AuthShell title={reason.title} intro={reason.body}>
      <Card className="mt-6 p-6 text-sm text-ink-600 dark:text-ink-400">
        <p>
          Nothing arrived? Check the spam folder, then{" "}
          <Link
            href={`/login?next=${encodeURIComponent(next)}`}
            className="font-medium text-eclipse-700 hover:underline dark:text-eclipse-400"
          >
            ask for another one
          </Link>
          . Links can only be used once, so an old one in your inbox will not work.
        </p>
      </Card>
    </AuthShell>
  );
}
