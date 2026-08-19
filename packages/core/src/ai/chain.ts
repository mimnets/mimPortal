import { NoProviderAvailable, ProviderError, type AiProvider, type AiRequest } from "./provider";

/**
 * Tries providers in order and moves on when one fails.
 *
 * The point is that free models are unreliable in a way paid ones are not: OpenRouter's free
 * tier retires models, rate-limits hard, and returns 503 under load. A Site should be able
 * to lead with a free model and quietly pay only when it has to, rather than choosing once
 * between "free but flaky" and "reliable but billed".
 *
 * **It only falls back before the first token.** Once a provider has emitted text, a failure
 * is surfaced rather than retried — switching mid-stream would either duplicate what the
 * Author has already watched appear or splice two models' half-sentences together, and both
 * are worse than an error. This is the whole subtlety of the design and the reason the
 * `started` flag exists.
 */
export function providerChain(providers: AiProvider[]): AiProvider {
  const usable = providers.filter(Boolean);

  return {
    name: usable.length > 0 ? `${usable[0]!.name} (+${usable.length - 1} fallbacks)` : "none",
    model: usable[0]?.model ?? "",
    free: usable[0]?.free ?? false,
    // A chain can be sent an image if any provider in it can read one; the ones that
    // cannot are filtered out before an image request is made.
    vision: usable.some((provider) => provider.vision),

    async *stream(request: AiRequest) {
      const attempts: { provider: string; reason: string }[] = [];

      for (const provider of usable) {
        let started = false;

        try {
          for await (const chunk of provider.stream(request)) {
            started = true;
            yield chunk;
          }
          return;
        } catch (cause) {
          // The Author cancelled. Not a provider problem, and not something a second
          // provider should be woken up for.
          if (cause instanceof Error && cause.name === "AbortError") throw cause;

          if (started) throw cause;

          // A bug in this codebase would otherwise be retried against every vendor in turn
          // and reported as the last one's fault.
          if (!(cause instanceof ProviderError)) throw cause;

          attempts.push({ provider: `${provider.name}`, reason: describe(cause) });
        }
      }

      throw new NoProviderAvailable(attempts);
    },
  };
}

function describe(error: ProviderError): string {
  if (error.status === 429) return "rate limited";
  if (error.status === 401 || error.status === 403) return "key rejected";
  if (error.status === 404) return "model not available";
  if (error.status && error.status >= 500) return `unavailable (${error.status})`;
  return error.message.replace(`${error.provider}: `, "").slice(0, 120);
}

/** Collects the whole response. For generation that is validated before anything is shown. */
export async function collect(provider: AiProvider, request: AiRequest): Promise<string> {
  let text = "";
  for await (const chunk of provider.stream(request)) text += chunk;
  return text;
}
