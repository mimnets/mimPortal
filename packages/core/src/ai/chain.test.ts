import { describe, expect, it } from "vitest";

import { collect, providerChain } from "./chain";
import { NoProviderAvailable, ProviderError, type AiProvider } from "./provider";

/**
 * The chain is the whole point of having more than one provider, and its one subtle rule —
 * fall back only before the first token — is not something a reader can check by eye.
 */

function provider(
  name: string,
  behaviour: { chunks?: string[]; failAfter?: number; error?: Error },
): AiProvider {
  return {
    name,
    model: `${name}-model`,
    free: false,
    async *stream() {
      const chunks = behaviour.chunks ?? [];
      for (let i = 0; i < chunks.length; i++) {
        if (behaviour.failAfter !== undefined && i === behaviour.failAfter) {
          throw behaviour.error ?? new ProviderError(name, "died mid-stream");
        }
        yield chunks[i]!;
      }
      if (behaviour.failAfter === chunks.length) {
        throw behaviour.error ?? new ProviderError(name, "died at the end");
      }
    },
  };
}

const request = { system: "s", prompt: "p" };

describe("the provider chain", () => {
  it("uses the first provider that works", async () => {
    const chain = providerChain([
      provider("free", { chunks: ["hello ", "world"] }),
      provider("paid", { chunks: ["never asked"] }),
    ]);

    expect(await collect(chain, request)).toBe("hello world");
  });

  it("moves to the next provider when the first fails before producing anything", async () => {
    // The case this exists for: a free model that is rate limited or has been retired.
    const chain = providerChain([
      provider("free", { failAfter: 0, error: new ProviderError("free", "rate limited", 429) }),
      provider("paid", { chunks: ["from the paid one"] }),
    ]);

    expect(await collect(chain, request)).toBe("from the paid one");
  });

  it("walks the whole chain, not just one step", async () => {
    const chain = providerChain([
      provider("a", { failAfter: 0 }),
      provider("b", { failAfter: 0 }),
      provider("c", { failAfter: 0 }),
      provider("d", { chunks: ["fourth"] }),
    ]);

    expect(await collect(chain, request)).toBe("fourth");
  });

  it("does NOT fall back once text has been emitted", async () => {
    // Switching mid-stream would either repeat what the Author already watched appear or
    // splice two models' half-sentences together. Both are worse than an error.
    let paidWasAsked = false;

    const chain = providerChain([
      provider("free", { chunks: ["half a sen"], failAfter: 1 }),
      {
        name: "paid",
        model: "m",
        free: false,
        async *stream() {
          paidWasAsked = true;
          yield "a whole different sentence";
        },
      },
    ]);

    await expect(collect(chain, request)).rejects.toThrow(ProviderError);
    expect(paidWasAsked).toBe(false);
  });

  it("keeps what arrived before a mid-stream failure", async () => {
    const chain = providerChain([provider("free", { chunks: ["kept"], failAfter: 1 })]);

    let text = "";
    await expect(
      (async () => {
        for await (const chunk of chain.stream(request)) text += chunk;
      })(),
    ).rejects.toThrow();

    expect(text).toBe("kept");
  });

  it("reports every attempt when nothing works", async () => {
    const chain = providerChain([
      provider("free", { failAfter: 0, error: new ProviderError("free", "gone", 404) }),
      provider("paid", { failAfter: 0, error: new ProviderError("paid", "nope", 401) }),
    ]);

    await expect(collect(chain, request)).rejects.toThrow(NoProviderAvailable);
    // An Owner debugging this needs to see both, and what each one said.
    await expect(collect(chain, request)).rejects.toThrow(/free \(model not available\)/);
    await expect(collect(chain, request)).rejects.toThrow(/paid \(key rejected\)/);
  });

  it("says so plainly when nothing is configured at all", async () => {
    await expect(collect(providerChain([]), request)).rejects.toThrow(
      /No AI provider is configured/,
    );
  });

  it("does not try another provider when the Author cancelled", async () => {
    // An abort is a person changing their mind, not a provider failing. Falling back here
    // would start a second request the moment the first was stopped.
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    let paidWasAsked = false;

    const chain = providerChain([
      provider("free", { failAfter: 0, error: abort }),
      {
        name: "paid",
        model: "m",
        free: false,
        async *stream() {
          paidWasAsked = true;
          yield "should not happen";
        },
      },
    ]);

    await expect(collect(chain, request)).rejects.toThrow("aborted");
    expect(paidWasAsked).toBe(false);
  });

  it("does not retry a programming error against every vendor in turn", async () => {
    // A TypeError is a bug here, not a provider being down. Retrying it four times would
    // report the last vendor's name for a fault none of them had.
    let secondWasAsked = false;

    const chain = providerChain([
      provider("first", { failAfter: 0, error: new TypeError("undefined is not a function") }),
      {
        name: "second",
        model: "m",
        free: false,
        async *stream() {
          secondWasAsked = true;
          yield "";
        },
      },
    ]);

    await expect(collect(chain, request)).rejects.toThrow(TypeError);
    expect(secondWasAsked).toBe(false);
  });
});
