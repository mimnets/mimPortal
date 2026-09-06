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

/**
 * The prefix on an extra question's input, followed by its position in the Block.
 *
 * A position rather than the Author's label, and that is the whole design. An input's `name`
 * is visitor input by the time it comes back -- the same reasoning that took `recipient` out
 * of the markup -- so a label must never be what identifies the answer, or a visitor could
 * invent questions the Author never asked and have them stored beside the real ones. The
 * server reads the labels from the published Block, at the same index, and pairs them up.
 *
 * It follows that reordering the questions on a Block relabels answers already stored. That
 * is why an Enquiry keeps the label it was submitted with rather than looking it up on read.
 */
export const FORM_EXTRA_PREFIX = "x_";

/** The input name for the extra question at this position. */
export function extraFieldName(index: number): string {
  return `${FORM_EXTRA_PREFIX}${index}`;
}

/** One answer to a question the Author added, as it is stored. */
export interface ExtraAnswer {
  /** The question, copied from the Block at the moment it was answered. */
  label: string;
  value: string;
}

/**
 * Pairs the posted answers with the labels the published Block asked for.
 *
 * Anything the visitor sent that does not correspond to a declared question is dropped: the
 * Block is the list of questions, and a form post is not allowed to add to it.
 */
export function extraAnswers(
  labels: readonly string[],
  read: (name: string) => string,
): ExtraAnswer[] {
  const answers: ExtraAnswer[] = [];

  labels.forEach((label, index) => {
    const value = read(extraFieldName(index)).trim();
    const question = label.trim();
    if (question && value) answers.push({ label: question, value });
  });

  return answers;
}

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
