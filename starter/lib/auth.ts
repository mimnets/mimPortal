import { createAuth } from "@mimnets/core/auth";
import { createDatabase } from "@mimnets/core/db";

import { authSecret, baseUrl, requireDatabaseUrl } from "./env";

/**
 * One auth instance per Site. Created lazily so that a Site which has not been installed
 * yet can still serve /install instead of crashing on a missing secret.
 */
let cached: ReturnType<typeof createAuth> | null = null;

export function auth() {
  cached ??= createAuth(createDatabase(requireDatabaseUrl()), {
    secret: authSecret(),
    baseURL: baseUrl(),
  });
  return cached;
}
