import type { Metadata } from "next";

import { NewPostPage } from "../../_posts/new-post-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New community post",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <NewPostPage kind="community" />;
}
