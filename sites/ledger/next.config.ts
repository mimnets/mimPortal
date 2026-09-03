import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

const here = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // No transpilePackages. The Starter needs it because the monorepo hands it TypeScript
  // source; Ledger installs the published packages, which ship compiled JavaScript and
  // declarations. If this line were needed here, the build step would not have worked.

  // A self-contained server bundle, so a Site runs on any host that can run a container
  // or a Node process — not only on the platform it was first deployed to (ADR-0008).
  output: "standalone",
  outputFileTracingRoot: here,
};

export default nextConfig;
