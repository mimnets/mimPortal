import { createHmac, timingSafeEqual } from "node:crypto";

import { FORM_FIELDS } from "./shared";

/**
 * Spam protection as a list of checks a Site can change.
 *
 * Three ship: a honeypot, a timing check and a per-IP rate limit. None of them asks a person
 * to prove anything, which is the point — a CAPTCHA taxes every real visitor, disproportionately
 * those using a screen reader, to inconvenience a bot that can pay to solve it.
 *
 * A Site that is genuinely under attack adds a fourth check to the array in `lib/spam.ts`
 * rather than editing the contact Block. That is why this is a list and not three `if`
 * statements: the decision to add a CAPTCHA should not reach the form's markup.
 */

export interface SpamCheckInput {
  /** What the visitor submitted, honeypot and bookkeeping fields included. */
  fields: Record<string, string>;
  /** Milliseconds between the form being rendered and submitted; null if unverifiable. */
  elapsedMs: number | null;
  /** A salted hash of the sender's IP. The address itself is never held. */
  ipHash: string;
  /** How many submissions this IP has already had accepted inside the window. */
  recentFromIp: () => Promise<number>;
}

export interface SpamSignal {
  name: string;
  /** A reason to reject, or null to let the submission through. */
  check(input: SpamCheckInput): Promise<string | null> | string | null;
}

export interface SpamVerdict {
  rejected: boolean;
  /** Which signal objected, for the Dashboard and the logs. Never shown to the sender. */
  signal?: string;
  reason?: string;
}

/**
 * A field no person can see and no person will fill in. Bots that parse the DOM and complete
 * every input give themselves away here, which is most of them and costs a visitor nothing.
 */
export function honeypotSignal(): SpamSignal {
  return {
    name: "honeypot",
    check: ({ fields }) =>
      (fields[FORM_FIELDS.honeypot] ?? "").trim() === ""
        ? null
        : "A field that should have been left empty was filled in.",
  };
}

/**
 * Nobody reads a form, writes a message and submits it in under a couple of seconds. A script
 * posting the moment the page parses does exactly that.
 *
 * An unverifiable timestamp is treated as suspicious rather than fine: the timestamp is
 * signed, so the only way to arrive without a valid one is to have built the request by hand.
 */
export function timingSignal(options: { minimumMs?: number; maximumMs?: number } = {}): SpamSignal {
  const minimum = options.minimumMs ?? 2_000;
  // A form open for half a day is a stale tab, and its signature has probably expired.
  const maximum = options.maximumMs ?? 12 * 60 * 60 * 1000;

  return {
    name: "timing",
    check: ({ elapsedMs }) => {
      if (elapsedMs === null) return "The form was submitted without a valid timestamp.";
      if (elapsedMs < minimum) return "The form was submitted too quickly to have been read.";
      if (elapsedMs > maximum) return "The form was left open too long. Please try again.";
      return null;
    },
  };
}

/**
 * A ceiling on how often one sender can submit. This is the check that stops a flood rather
 * than a single forged request, and the only one that costs a database read.
 */
export function rateLimitSignal(options: { max?: number } = {}): SpamSignal {
  const max = options.max ?? 5;

  return {
    name: "rate limit",
    check: async ({ recentFromIp }) =>
      (await recentFromIp()) >= max
        ? `More than ${max} submissions from one sender in a short time.`
        : null,
  };
}

/**
 * Runs the checks in order and stops at the first objection.
 *
 * Order matters for cost, not for correctness: the honeypot and the timing check are free,
 * and the rate limit queries the database, so a bot that trips the honeypot never reaches it.
 */
export async function runSpamChecks(
  signals: SpamSignal[],
  input: SpamCheckInput,
): Promise<SpamVerdict> {
  for (const signal of signals) {
    const reason = await signal.check(input);
    if (reason) return { rejected: true, signal: signal.name, reason };
  }
  return { rejected: false };
}

/* ---- The signed timestamp the timing check relies on --------------------- */

/**
 * The timestamp is signed because an unsigned one is a suggestion. A bot that can read the
 * hidden field can also set it to whatever passes, which would leave the timing check
 * measuring the bot's honesty.
 */
export function signRenderedAt(now: number, secret: string): string {
  const value = String(now);
  return `${value}.${createHmac("sha256", secret).update(value).digest("base64url")}`;
}

/** Milliseconds since the form was rendered, or null if the stamp was absent or forged. */
export function elapsedSince(stamp: string | undefined, secret: string, now: number): number | null {
  if (!stamp) return null;

  const separator = stamp.lastIndexOf(".");
  if (separator <= 0) return null;

  const value = stamp.slice(0, separator);
  const provided = stamp.slice(separator + 1);
  const expected = createHmac("sha256", secret).update(value).digest("base64url");

  // Compared in constant time. The window is not a secret, but the habit is worth keeping
  // and the cost is nothing.
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const rendered = Number(value);
  if (!Number.isFinite(rendered)) return null;

  return now - rendered;
}

/**
 * Submissions are attributed to a salted hash rather than to an address. Rate limiting needs
 * to tell senders apart, which does not require knowing who they are — and a table of IP
 * addresses attached to messages is a thing a client would have to disclose.
 */
export function hashIp(ip: string, secret: string): string {
  return createHmac("sha256", secret).update(ip).digest("base64url").slice(0, 32);
}
