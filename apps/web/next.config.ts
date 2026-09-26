import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const config: NextConfig = {
  reactStrictMode: true,
  // `contracts`, `core` and `db` ship as TypeScript source rather than as built
  // packages, so Next has to compile them rather than treat them as externals.
  transpilePackages: ["@ps/contracts", "@ps/core", "@ps/db", "@ps/cards"],
  // The MDX info pages are read from `content/pages/` at request time, by the
  // footer nav on every route as well as by the pages themselves, and the card
  // dataset from `data/cards/` by `@ps/cards`. Tracing can only find a directory
  // it is told about.
  outputFileTracingRoot: REPO_ROOT,
  // A post's image upload is a server action (E20.25). Storage caps a file at
  // 4 MB; this leaves room for the multipart overhead, under Vercel's 4.5 MB.
  experimental: { serverActions: { bodySizeLimit: "4.5mb" } },
  outputFileTracingIncludes: { "/**": ["../../content/pages/**", "../../data/cards/*.json"] },
  // Community posts lived at `/articles` until the rename. Links to them are
  // already out in the world — every Reddit export ends with one — so the old
  // paths stay working, permanently.
  redirects() {
    return [
      { source: "/articles", destination: "/community", permanent: true },
      { source: "/articles/:slug", destination: "/community/:slug", permanent: true },
      {
        source: "/dashboard/articles/:path*",
        destination: "/dashboard/community/:path*",
        permanent: true,
      },
    ];
  },
};

export default config;
