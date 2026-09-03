/**
 * Where generated text comes from.
 *
 * A Site names a chain of providers and everything above this interface deals in prompts
 * and chunks, never in vendors. That matters twice over: a client who insists on a
 * particular vendor is a configuration change (ADR-0007), and a free model that goes down
 * at four in the afternoon is not an outage (ADR-0014).
 */

export interface AiRequest {
  /** What the model is, and what it must not do. Stable across a Site's requests. */
  system: string;
  /** The instruction and the text it acts on. */
  prompt: string;
  maxTokens?: number;
  /**
   * Cancels the request. An Author who presses Rewrite and changes their mind should stop
   * paying for the rest of the sentence, so this is threaded all the way to the socket.
   */
  signal?: AbortSignal;
  /** Ask for JSON only. Presets need it; rewriting a heading does not. */
  json?: boolean;
  /**
   * An image for the model to look at, as a data URL.
   *
   * Only providers reporting `vision` accept one. A model sent an image it cannot read
   * either errors or, worse, quietly answers as though the image were not there.
   */
  image?: string;
  /**
   * How long the stream may produce nothing before it is abandoned, in milliseconds.
   *
   * `signal` alone is not enough. It carries an Author who changed their mind and a visitor
   * who closed the tab — both of which require somebody to *do* something. An upstream that
   * accepts the connection and then says nothing produces neither, and the request waits for
   * as long as the platform allows. That is the case this exists for.
   */
  idleMs?: number;
}

/**
 * How long a stream may say nothing before it is treated as hung.
 *
 * The first attempt at this was a deadline on the whole request, and it was the wrong tool.
 * A streaming call to a model that thinks before it speaks is legitimately slow — a Preset
 * is a Theme plus several Pages of copy, and free models take minutes — so any total long
 * enough not to kill real work is too long to catch a hang, and any total short enough to
 * catch a hang kills real work. It did: generation began failing with TimeoutError partway
 * through, and `chain.ts` rethrows rather than falling through once a stream has started, so
 * there was not even a fallback to save it.
 *
 * Silence is the signal that actually distinguishes the two. A model producing tokens is
 * working however slowly; one that has produced nothing for this long is not coming back.
 */
export const AI_IDLE_MS = 45_000;

/**
 * How long a stream may take to say anything at all.
 *
 * Separate from the gap between chunks, and considerably longer, because they are different
 * events. A model that reasons before it writes produces nothing for a long time and then
 * writes steadily — measured well past a minute on the free models this Site tries first —
 * so treating first-token latency as a hang abandons work that was about to arrive. A gap of
 * the same length *after* the writing has started is a stall, and means something else.
 */
export const AI_FIRST_TOKEN_MS = 150_000;

/**
 * A signal that aborts when the stream goes quiet.
 *
 * `bump()` is called as each chunk arrives, which restarts the clock; `done()` releases the
 * timer. Composed with the caller's own signal so cancelling still works — an Author who
 * presses Escape must not have to wait for silence.
 */
export function idleGuard(
  signal: AbortSignal | undefined,
  idleMs = AI_IDLE_MS,
  firstMs = AI_FIRST_TOKEN_MS,
) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let started = false;

  const bump = () => {
    if (timer) clearTimeout(timer);
    // The wait before the first chunk is thinking; every wait after it is a stall.
    const window = started ? idleMs : firstMs;
    started = true;
    timer = setTimeout(
      () => controller.abort(new DOMException("The model stopped responding.", "TimeoutError")),
      window,
    );
  };

  const done = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
  };

  bump();

  return {
    signal: signal ? AbortSignal.any([signal, controller.signal]) : controller.signal,
    bump,
    done,
    /**
     * Whether this guard fired, rather than the caller cancelling.
     *
     * The two abort the same composed signal and have to be told apart: an Author pressing
     * Escape must stop the chain, while a provider that went silent must hand over to the
     * next one. Providers report the second as a ProviderError, which is the only thing
     * `chain.ts` will move on from.
     */
    expired: () => controller.signal.aborted,
  };
}

export interface AiProvider {
  /** Shown to an Owner in the Dashboard, so "which one answered?" has an answer. */
  readonly name: string;
  readonly model: string;
  /** Whether this provider costs money. The Dashboard says so before an Owner relies on it. */
  readonly free: boolean;
  /** Whether it can be sent an image. Not every model can, including free ones. */
  readonly vision: boolean;
  stream(request: AiRequest): AsyncIterable<string>;
}

/**
 * A provider failing in a way the next one might survive — it was rate limited, it was
 * overloaded, the key was rejected, the network went away.
 *
 * Distinguished from a programming error on purpose: a chain that swallows a TypeError
 * would try four vendors in a row against the same bug and report the last one's message.
 */
export class ProviderError extends Error {
  constructor(
    readonly provider: string,
    message: string,
    readonly status?: number,
  ) {
    super(`${provider}: ${message}`);
    this.name = "ProviderError";
  }
}

/** Nothing in the chain produced anything. Carries every attempt, because an Owner debugging this needs all of them. */
export class NoProviderAvailable extends Error {
  constructor(readonly attempts: { provider: string; reason: string }[]) {
    super(
      attempts.length === 0
        ? "No AI provider is configured. Set one of the AI_* keys — see docs/AI.md."
        : `Every provider failed. ${attempts.map((a) => `${a.provider} (${a.reason})`).join("; ")}`,
    );
    this.name = "NoProviderAvailable";
  }
}
