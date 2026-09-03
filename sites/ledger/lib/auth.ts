import { createAuth } from "@mimnets/core/auth";
import { createDatabase } from "@mimnets/core/db";

import { email } from "./email";
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
    // The same adapter the contact form uses. On a Site with no mail configured this drops
    // the reset link into the server log rather than sending it, which is the honest
    // behaviour for a Site that has not been told how to send.
    sendEmail: (message) => email().send(message),
  });
  return cached;
}
