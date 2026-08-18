import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

const here = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Workspace packages are consumed as TypeScript source until M8 adds a build step.
  transpilePackages: ["@mimnets/core", "@mimnets/blocks", "@mimnets/admin"],

  // A self-contained server bundle, so a Site runs on any host that can run a container
  // or a Node process — not only on the platform it was first deployed to (ADR-0008).
  // The tracing root is the monorepo root, so workspace packages are traced into the bundle.
  output: "standalone",
  outputFileTracingRoot: join(here, ".."),
};

export default nextConfig;
