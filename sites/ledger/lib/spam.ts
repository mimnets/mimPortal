import { honeypotSignal, rateLimitSignal, timingSignal, type SpamSignal } from "@mimnets/core/forms";

/**
 * The spam checks this Site runs, in order.
 *
 * **This is the file to edit if a Site starts getting spam.** Adding a CAPTCHA means pushing
 * one more signal onto this array — it does not mean touching the contact Block, because the
 * decision to tax every visitor should not be buried in markup.
 *
 * A signal is an object with a name and a `check` that returns a reason to reject, or null.
 * Anything can be one: a Turnstile verification, a blocklist, a check that the message
 * contains fewer than four links.
 *
 *     import { verifyTurnstile } from "./turnstile";
 *
 *     export const spamSignals = [
 *       honeypotSignal(),
 *       timingSignal(),
 *       rateLimitSignal(),
 *       verifyTurnstile({ secret: process.env.TURNSTILE_SECRET! }),
 *     ];
 *
 * The order is cost, not importance: the first two are free, and the rate limit reads the
 * database, so anything a free check catches never reaches it.
 */
export const spamSignals: SpamSignal[] = [
  honeypotSignal(),
  // Nobody reads a form and writes a message in under two seconds.
  timingSignal({ minimumMs: 2_000 }),
  // Five accepted submissions from one sender in the window below.
  rateLimitSignal({ max: 5 }),
];

/** How far back the rate limit counts. */
export const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
