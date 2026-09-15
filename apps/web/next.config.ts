import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // `contracts`, `core` and `db` ship as TypeScript source rather than as built
  // packages, so Next has to compile them rather than treat them as externals.
  transpilePackages: ["@ps/contracts", "@ps/core", "@ps/db"],
};

export default config;
