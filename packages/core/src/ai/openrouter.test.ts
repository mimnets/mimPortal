import { describe, expect, it } from "vitest";

import { collect, providerChain } from "./chain";
import { openRouterProvider } from "./openai-compatible";
import { assistPrompt } from "./assist";

/**
 * The provider chain against OpenRouter's real API.
 *
 * Worth running against the real thing rather than a mock for one specific reason: the free
 * model IDs in `starter/lib/ai.ts` go stale. OpenRouter retires free models without notice,
 * and the failure looks exactly like a broken integration — the buttons are there, nothing
 * comes back. A mock would pass forever while the Site's defaults rotted.
 *
 * Skipped, not failed, when OPENROUTER_API_KEY is unset, so a contributor without a key
 * still gets a green suite.
 */
const key = process.env.OPENROUTER_API_KEY;
const suite = key ? describe : describe.skip;

/** Kept in step with DEFAULT_FREE_MODELS in starter/lib/ai.ts. */
const FREE_MODELS = [
  "nvidia/nemotron-3-super-120b-a12b:free",
  "google/gemma-4-26b-a4b-it:free",
  "openrouter/free",
];

suite("OpenRouter, for real", () => {
  const chain = providerChain(
    FREE_MODELS.map((model) => openRouterProvider({ apiKey: key!, model, free: true })),
  );

  it(
    "at least one of the Starter's free models still answers",
    async () => {
      // The assertion that matters. If this fails, the defaults need updating — see
      // https://openrouter.ai/models?max_price=0
      const { system, prompt } = assistPrompt("proofread", "teh cat sat on teh mat.", {});
      const answer = await collect(chain, { system, prompt, maxTokens: 200 });

      expect(answer.trim().length).toBeGreaterThan(0);
      // Proofreading is the one action with a checkable result.
      expect(answer.toLowerCase()).toContain("the cat sat on the mat");
    },
    60_000,
  );

  it(
    "streams rather than arriving all at once",
    async () => {
      // The Editor's whole reason for using a route handler instead of a server action.
      //
      // A short reply can legitimately arrive in one frame, so this asks for enough text
      // that a provider buffering the whole thing would be the only way to get one chunk.
      let chunks = 0;
      for await (const chunk of chain.stream({
        system: "You write plain prose.",
        prompt: "Write roughly 200 words about why bicycles are worth maintaining.",
        maxTokens: 600,
      })) {
        if (chunk.length > 0) chunks++;
        if (chunks > 2) break;
      }

      expect(chunks).toBeGreaterThan(2);
    },
    60_000,
  );

  it(
    "reports a model that no longer exists rather than hanging",
    async () => {
      const gone = openRouterProvider({
        apiKey: key!,
        model: "not-a-vendor/not-a-model:free",
        free: true,
      });

      await expect(collect(gone, { system: "s", prompt: "p" })).rejects.toThrow();
    },
    60_000,
  );

  it(
    "falls past a dead model to a working one",
    async () => {
      // Exactly what happens the day OpenRouter retires the first name in the list.
      const withDeadHead = providerChain([
        openRouterProvider({ apiKey: key!, model: "not-a-vendor/not-a-model:free", free: true }),
        ...FREE_MODELS.map((model) => openRouterProvider({ apiKey: key!, model, free: true })),
      ]);

      const answer = await collect(withDeadHead, {
        system: "You reply with one word.",
        prompt: "Reply with the single word: ready",
        maxTokens: 50,
      });

      expect(answer.trim().length).toBeGreaterThan(0);
    },
    90_000,
  );
});
