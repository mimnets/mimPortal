import { describe, expect, it } from "vitest";

import { AI_FIRST_TOKEN_MS, AI_IDLE_MS, idleGuard } from "./provider";

/**
 * A request nobody cancels still has to end — but only if it has actually stopped.
 *
 * `AiRequest.signal` was already threaded to the socket, and it carries an Author who
 * pressed Escape or a visitor who closed the tab: both need somebody to *do* something. An
 * upstream that accepts the connection and then goes quiet produces neither, and nothing in
 * the AI stack stopped it.
 *
 * The first attempt at this used a deadline on the whole request and was wrong, which these
 * tests exist partly to record. Generation against a free model is legitimately slow — the
 * Preset suite began failing partway through with TimeoutError, and `chain.ts` rethrows
 * rather than trying another provider once a stream has started, so nothing rescued it. Any
 * total generous enough to allow real work is too generous to catch a hang.
 *
 * Silence separates them. A model still producing tokens is working, however slowly.
 */

function reason(signal: AbortSignal): string {
  return (signal.reason as { name?: string } | undefined)?.name ?? "";
}

const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("abandoning a stream that has gone quiet", () => {
  it("does not abort while it is still being fed", async () => {
    const guard = idleGuard(undefined, 60, 60);

    for (let i = 0; i < 5; i += 1) {
      await tick(25);
      guard.bump();
    }

    // 125ms of work under a 60ms idle limit, and still alive — because it never went quiet
    // for 60ms at a stretch. This is the case a total deadline got wrong.
    expect(guard.signal.aborted).toBe(false);
    guard.done();
  });

  it("aborts once nothing has arrived for long enough", async () => {
    const guard = idleGuard(undefined, 30, 30);

    await tick(90);

    expect(guard.signal.aborted).toBe(true);
    expect(reason(guard.signal)).toBe("TimeoutError");
    guard.done();
  });

  it("starts its clock immediately, so a stream that never begins is caught", async () => {
    const guard = idleGuard(undefined, 5, 30);

    // No bump at all: the provider connected and said nothing.
    await tick(90);

    expect(guard.signal.aborted).toBe(true);
    guard.done();
  });

  /**
   * The refinement the Preset suite forced. Free models reason for a long time before
   * writing anything and then write steadily; a single window sized for the gap between
   * chunks killed real generation partway through, three times over.
   */
  it("waits longer for the first chunk than for the ones after it", async () => {
    const guard = idleGuard(undefined, 20, 120);

    // Well past the inter-chunk limit, still thinking. Not a hang.
    await tick(60);
    expect(guard.signal.aborted).toBe(false);

    // The first chunk arrives; from here the shorter window applies.
    guard.bump();
    await tick(60);
    expect(guard.signal.aborted).toBe(true);
    guard.done();
  });

  it("still aborts when the caller cancels, without waiting for silence", () => {
    const controller = new AbortController();
    const guard = idleGuard(controller.signal, 60_000, 60_000);

    controller.abort();

    expect(guard.signal.aborted).toBe(true);
    // The caller's reason survives, so "the Author changed their mind" stays distinguishable
    // from "the model stopped" — chain.ts branches on exactly that.
    expect(reason(guard.signal)).not.toBe("TimeoutError");
    guard.done();
  });

  it("leaves the caller's own signal untouched when it expires", async () => {
    const controller = new AbortController();
    const guard = idleGuard(controller.signal, 30, 30);

    await tick(90);

    expect(guard.signal.aborted).toBe(true);
    expect(controller.signal.aborted).toBe(false);
    guard.done();
  });

  it("stops holding a timer once released", async () => {
    const guard = idleGuard(undefined, 30, 30);
    guard.done();

    await tick(90);

    // Nothing fires after done(), so a finished stream cannot abort itself late.
    expect(guard.signal.aborted).toBe(false);
  });

  it("allows enough silence for a model that thinks before it speaks", () => {
    expect(AI_IDLE_MS).toBeGreaterThanOrEqual(30_000);
    expect(AI_FIRST_TOKEN_MS).toBeGreaterThan(AI_IDLE_MS);
  });
});

/**
 * Telling the guard's own expiry apart from the caller's cancellation.
 *
 * Both abort the same composed signal, and the difference decides what the chain does.
 * A provider that went silent has failed and the next one should try; an Author who pressed
 * Escape has decided, and waking another vendor would bill them for a change of mind.
 *
 * This distinction is the whole of the bug that made the Preset suite fail: the guard threw
 * a raw TimeoutError, `chain.ts` moves on only for a ProviderError, so a silent free model
 * took the request down instead of handing over to the configured fallback.
 */
describe("whose abort it was", () => {
  const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  it("reports expiry when the guard itself fired", async () => {
    const guard = idleGuard(undefined, 20, 20);
    await tick(60);

    expect(guard.expired()).toBe(true);
    guard.done();
  });

  it("does not report expiry when the caller cancelled", () => {
    const controller = new AbortController();
    const guard = idleGuard(controller.signal, 60_000, 60_000);

    controller.abort();

    expect(guard.signal.aborted).toBe(true);
    // Aborted, but not by us — the chain must stop rather than try another provider.
    expect(guard.expired()).toBe(false);
    guard.done();
  });

  it("reports nothing while the stream is healthy", () => {
    const guard = idleGuard(undefined, 60_000, 60_000);

    expect(guard.expired()).toBe(false);
    guard.done();
  });
});
