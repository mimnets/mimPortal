import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "../../../../lib/auth";
import { signUpOpen } from "../../../../lib/install";

export const dynamic = "force-dynamic";

const handlers = toNextJsHandler(auth().handler);

export const GET = handlers.GET;

/**
 * There is no public registration. The sign-up endpoint answers only during onboarding,
 * which is the window the installer uses to create the first Owner; after that accounts are
 * created by an Owner through a server action, never over this route.
 *
 * The condition is positive on purpose. Asking "is the Site installed?" and opening sign-up
 * when the answer is no means an unreachable database re-opens registration.
 */
export async function POST(request: Request) {
  if (new URL(request.url).pathname.endsWith("/sign-up/email") && !(await signUpOpen())) {
    return new Response(JSON.stringify({ error: "Sign-up is closed on this Site." }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }

  return handlers.POST(request);
}
