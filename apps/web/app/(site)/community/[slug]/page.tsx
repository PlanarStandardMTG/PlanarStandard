import type { Metadata } from "next";

import { postMetadata, renderPostPage } from "@/components/content/post-page";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  return postMetadata((await params).slug, "community");
}

export default async function CommunityPostPage({ params }: Params) {
  return renderPostPage((await params).slug, "community");
}
