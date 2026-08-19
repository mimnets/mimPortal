import {
  anthropicProvider,
  deepSeekProvider,
  openAiProvider,
  openRouterProvider,
  providerChain,
  type AiProvider,
} from "@mimnets/core/ai";

import { baseUrl } from "./env";

/**
 * This Site's AI providers, in the order they are tried.
 *
 * Free first, paid after (ADR-0014). A free OpenRouter model answers most requests; when it
 * is rate limited, retired or overloaded, the next provider in the list picks up without the
 * Author seeing anything but a slightly slower reply.
 *
 * Nothing here is required. A Site with no keys has no assistant, and the Editor simply does
 * not offer the buttons.
 */

let cached: AiProvider | null | undefined;

/**
 * Free models come and go, so this is a list rather than one name: each is tried in turn.
 * Override it with AI_FREE_MODELS as a comma-separated list when OpenRouter's catalogue
 * moves, which it does.
 */
const DEFAULT_FREE_MODELS = [
  "deepseek/deepseek-chat-v3.1:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "qwen/qwen-2.5-72b-instruct:free",
];

export function aiProvider(): AiProvider | null {
  if (cached !== undefined) return cached;

  const providers: AiProvider[] = [];
  const openRouterKey = process.env.OPENROUTER_API_KEY;

  if (openRouterKey) {
    const free = (process.env.AI_FREE_MODELS ?? DEFAULT_FREE_MODELS.join(","))
      .split(",")
      .map((model) => model.trim())
      .filter(Boolean);

    for (const model of free) {
      providers.push(
        openRouterProvider({
          apiKey: openRouterKey,
          model,
          free: true,
          siteUrl: baseUrl(),
          siteName: process.env.SITE_NAME ?? "Mimnets Site",
        }),
      );
    }

    // A paid OpenRouter model, if the Owner named one — one key, both tiers.
    if (process.env.AI_OPENROUTER_MODEL) {
      providers.push(
        openRouterProvider({
          apiKey: openRouterKey,
          model: process.env.AI_OPENROUTER_MODEL,
          siteUrl: baseUrl(),
          siteName: process.env.SITE_NAME ?? "Mimnets Site",
        }),
      );
    }
  }

  // Paid fallbacks, in the order an Owner is most likely to already have an account.
  if (process.env.ANTHROPIC_API_KEY) {
    providers.push(
      anthropicProvider({
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: process.env.AI_ANTHROPIC_MODEL,
      }),
    );
  }

  if (process.env.OPENAI_API_KEY) {
    providers.push(
      openAiProvider({
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.AI_OPENAI_MODEL,
      }),
    );
  }

  if (process.env.DEEPSEEK_API_KEY) {
    providers.push(
      deepSeekProvider({
        apiKey: process.env.DEEPSEEK_API_KEY,
        model: process.env.AI_DEEPSEEK_MODEL,
      }),
    );
  }

  cached = providers.length > 0 ? providerChain(providers) : null;
  return cached;
}

/** Whether the Editor should offer the assistant at all. */
export function aiConfigured(): boolean {
  return aiProvider() !== null;
}

/* ---- Rate limiting ------------------------------------------------------- */

/**
 * A ceiling on how often one person can ask, per Site.
 *
 * In memory, and therefore per instance: this is a cost guard, not a security boundary, and
 * the thing it guards against is a stuck key-repeat or an enthusiastic Author rather than an
 * attacker — the endpoint already requires a session. Making it a database table would add a
 * write to every keystroke-sized request to defend against something the login already stops.
 */
const REQUESTS = new Map<string, number[]>();
const WINDOW_MS = 60_000;

export function withinRateLimit(personId: string): boolean {
  const limit = Number(process.env.AI_REQUESTS_PER_MINUTE ?? 20);
  const now = Date.now();

  const recent = (REQUESTS.get(personId) ?? []).filter((at) => now - at < WINDOW_MS);
  if (recent.length >= limit) {
    REQUESTS.set(personId, recent);
    return false;
  }

  recent.push(now);
  REQUESTS.set(personId, recent);
  return true;
}
