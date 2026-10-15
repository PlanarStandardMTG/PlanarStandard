import type { Metadata } from "next";

import { EditPostPage } from "../../../_posts/edit-post-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Edit post",
  robots: { index: false, follow: false },
};

export default function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <EditPostPage kind="official" params={params} searchParams={searchParams} />;
}
