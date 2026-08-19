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
