import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const config: NextConfig = {
  reactStrictMode: true,
  // `contracts`, `core` and `db` ship as TypeScript source rather than as built
  // packages, so Next has to compile them rather than treat them as externals.
  transpilePackages: ["@ps/contracts", "@ps/core", "@ps/db"],
  // The MDX info pages are read from `content/pages/` at request time, by the
  // footer nav on every route as well as by the pages themselves. Tracing can
  // only find a directory it is told about.
  outputFileTracingRoot: REPO_ROOT,
  outputFileTracingIncludes: { "/**": ["../../content/pages/**"] },
};

export default config;
