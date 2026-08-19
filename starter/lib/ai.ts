import {
  anthropicProvider,
  deepSeekProvider,
  openAiCompatibleProvider,
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
 * Override it with AI_FREE_MODELS as a comma-separated list.
 *
 * `openrouter/free` leads deliberately. It is OpenRouter's own router across whatever is
 * currently free, so it does not go stale the way a pinned model ID does — an earlier
 * version of this list named three specific models and all three had already been retired.
 * The two behind it are pinned as a backstop for the day the router itself is busy.
 */
const DEFAULT_FREE_MODELS = [
  "nvidia/nemotron-3-super-120b-a12b:free",
  "google/gemma-4-26b-a4b-it:free",
  "openrouter/free",
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

  // A Site's own endpoint — a self-hosted model, a proxy, a vendor not listed here, or an
  // account on Together, Groq or Azure. Tried before the named vendors, because an Owner who
  // configured one meant it.
  const customUrl = process.env.AI_CUSTOM_BASE_URL;
  if (customUrl) {
    const format = (process.env.AI_CUSTOM_FORMAT ?? "openai").toLowerCase();
    const label = process.env.AI_CUSTOM_NAME ?? "Custom";
    const customKey = process.env.AI_CUSTOM_API_KEY ?? "";
    const customModel = process.env.AI_CUSTOM_MODEL;

    if (!customModel) {
      throw new Error("AI_CUSTOM_BASE_URL is set but AI_CUSTOM_MODEL is not. Name the model to call.");
    }

    if (format === "anthropic") {
      providers.push(
        anthropicProvider({
          apiKey: customKey,
          model: customModel,
          baseUrl: customUrl,
          name: label,
        }),
      );
    } else if (format === "openai") {
      providers.push(
        openAiCompatibleProvider({
          name: label,
          baseUrl: customUrl,
          apiKey: customKey,
          model: customModel,
        }),
      );
    } else {
      throw new Error(`AI_CUSTOM_FORMAT must be "openai" or "anthropic", not "${format}".`);
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
