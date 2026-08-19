/**
 * Names shared by the form a visitor sees and the server that checks it.
 *
 * The Block renders these inputs in a browser and the checks read them on the server, so
 * they live here rather than being written twice — a honeypot whose name drifts is a
 * honeypot that silently stops working, and nothing fails loudly when it does.
 */
export const FORM_FIELDS = {
  /** The bait. Hidden from people, irresistible to anything filling in every input. */
  honeypot: "website",
  /** A signed timestamp of when the form was rendered, for the timing check. */
  renderedAt: "mn_rendered",
  /** Which form on which Page this came from. */
  slug: "mn_form",
  /** Where to send the visitor back to. */
  returnTo: "mn_return",
} as const;

/** The query parameter a Page reads to know it should show a result message. */
export const FORM_RESULT_PARAM = "sent";

export type FormResult = "ok" | "error";

/**
 * Reduces a submitted return path to somewhere on this Site.
 *
 * The value arrives in a hidden field, which means anybody can set it. Handing it to
 * `new URL` unchecked turns a form endpoint into an open redirect: post the form with an
 * absolute URL and the Site itself bounces whoever submitted it onto someone else's domain.
 *
 * Only a path is ever needed, so only a path is accepted.
 */
export function safeReturnPath(input: string): string {
  // "//evil.example" and "/evil.example" are both protocol-relative to a browser.
  if (!input.startsWith("/")) return "/";
  if (input.startsWith("//")) return "/";
  if (input.startsWith("/\\")) return "/";
  return input;
}
