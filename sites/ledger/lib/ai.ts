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
/**
 * Which of the free models can read an image.
 *
 * Kept as a list rather than asked of the API at boot: a Site should not make a network call
 * before it can render, and OpenRouter's own catalogue is the thing that goes stale anyway.
 * A model here that loses vision fails the same way any retired model does — the chain moves
 * on and the Dashboard says why.
 */
const FREE_VISION_MODELS = new Set([
  // Verified against a real screenshot: it counted the bands correctly and named the logos
  // in the strip. Slow — around fifty seconds — but it genuinely reads a design.
  "google/gemma-4-26b-a4b-it:free",
  "google/gemma-4-31b-it:free",
  // Deliberately absent: nvidia/nemotron-nano-12b-v2-vl:free advertises vision and then
  // times out upstream on a real screenshot.
  "openrouter/free",
]);

const DEFAULT_FREE_MODELS = [
  "nvidia/nemotron-3-super-120b-a12b:free",
  "google/gemma-4-26b-a4b-it:free",
  "openrouter/free",
];

/**
 * Every provider this Site has configured, in the order the chain tries them.
 *
 * Exposed so the Dashboard can show what is available and let an Owner pick one for a
 * particular job — generating a whole Site is worth a better model than rewriting a heading,
 * and an Owner who has paid for both should be able to say which.
 */
export function aiProviders(): AiProvider[] {
  if (built !== undefined) return built;
  built = buildProviders();
  return built;
}

let built: AiProvider[] | undefined;

/** One named provider, for when an Owner has chosen. Falls back to the whole chain. */
export function aiProviderNamed(name: string | null | undefined): AiProvider | null {
  if (!name) return aiProvider();
  const found = aiProviders().find((provider) => provider.name === name);
  // A name that no longer matches anything means the environment changed under a saved
  // choice. The chain is the right answer then, not an error.
  return found ?? aiProvider();
}

export function aiProvider(): AiProvider | null {
  if (cached !== undefined) return cached;
  const providers = aiProviders();
  cached = providers.length > 0 ? providerChain(providers) : null;
  return cached;
}

function buildProviders(): AiProvider[] {
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
          vision: FREE_VISION_MODELS.has(model),
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

  return providers;
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

/**
 * Only the providers that can be sent an image.
 *
 * Filtered rather than hoped for: a model sent an image it cannot read either errors, or —
 * worse — answers confidently as though the image were not there, and nobody can tell the
 * difference from the output.
 */
export function visionProvider(): AiProvider | null {
  const capable = aiProviders().filter((provider) => provider.vision);
  return capable.length > 0 ? providerChain(capable) : null;
}

export function visionConfigured(): boolean {
  return visionProvider() !== null;
}
