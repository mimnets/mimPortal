import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import type { Database } from "../db/index";
import { account, session, user, verification } from "../db/auth-schema";

export interface AuthOptions {
  /** Signing secret. A Site that boots without one refuses to start rather than using a default. */
  secret: string;
  baseURL: string;
  /**
   * How a reset link reaches somebody. Injected rather than imported so that core's auth
   * half does not depend on its email half, and so a Site with no mail configured still
   * boots — the reset simply cannot complete, which is better than the Dashboard refusing
   * to start.
   */
  sendEmail?: (message: { to: string; subject: string; text: string }) => Promise<void>;
}

/**
 * Authentication for one Site.
 *
 * Email and password only: Sites are handed to clients, not to a developer audience, and a
 * social login button is one more account a client can lose access to. There is no public
 * sign-up — accounts are created by an Owner or by the installer, because an open sign-up
 * form on a client's brochure Site is a liability, not a feature.
 */
export function createAuth(db: Database, options: AuthOptions) {
  return betterAuth({
    secret: options.secret,
    baseURL: options.baseURL,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { user, session, account, verification },
    }),
    emailAndPassword: {
      enabled: true,
      // Sign-up stays enabled for the server-side API, which is how the installer creates
      // the first Owner and how an Owner later adds an Author. The HTTP endpoint is blocked
      // separately, so there is no public registration form.
      disableSignUp: false,

      // Without this an Author who forgets their password needs the Owner, and the Owner
      // needs a terminal. It uses the same EmailAdapter as the contact form, which is why
      // that adapter was worth building once rather than twice.
      sendResetPassword: options.sendEmail
        ? async ({ user: person, url }) => {
            await options.sendEmail!({
              to: person.email,
              subject: "Reset your password",
              text: [
                `Somebody asked to reset the password for ${person.email}.`,
                "",
                "Open this link to choose a new one:",
                url,
                "",
                "If it was not you, nothing has changed and you can ignore this.",
              ].join("\n"),
            });
          }
        : undefined,
    },
    user: {
      additionalFields: {
        role: { type: "string", defaultValue: "author", input: false },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
