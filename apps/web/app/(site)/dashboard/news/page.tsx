import type { Metadata } from "next";

import { OwnPostsPage } from "../_posts/own-posts-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your news posts",
  robots: { index: false, follow: false },
};

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <OwnPostsPage kind="official" searchParams={searchParams} />;
}
