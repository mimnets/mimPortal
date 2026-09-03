import Anthropic from "@anthropic-ai/sdk";

import { idleGuard, ProviderError, type AiProvider, type AiRequest } from "./provider";

/**
 * Anthropic, through the official SDK.
 *
 * The other providers in this directory are reached over plain HTTP because they all speak
 * the same OpenAI-compatible wire format and have no SDK worth the dependency. Anthropic has
 * one, so it is used — mixing a hand-rolled HTTP call with an available SDK is how request
 * shapes drift out of date without anything failing loudly.
 */
export function anthropicProvider(options: {
  apiKey: string;
  /** ADR-0007 fixes the default; an Owner may change it, an Author never sees it. */
  model?: string;
  free?: boolean;
  /**
   * Point at something other than api.anthropic.com — a gateway, a proxy, or any service
   * that speaks the Messages API. The SDK is still what builds the request, so the shape
   * stays correct wherever it is sent.
   */
  baseUrl?: string;
  /** What to call it in the Dashboard, when it is not Anthropic itself. */
  name?: string;
}): AiProvider {
  const model = options.model ?? "claude-opus-5";
  const client = new Anthropic({
    apiKey: options.apiKey,
    ...(options.baseUrl ? { baseURL: options.baseUrl } : {}),
  });

  return {
    name: options.name ?? "Anthropic",
    model,
    free: options.free ?? false,
    // Every current Claude model reads images.
    vision: true,

    async *stream(request: AiRequest) {
      const idle = idleGuard(request.signal, request.idleMs);

      try {
        const stream = client.messages.stream(
          {
            model,
            // Streaming, so there is room to be generous; the prompts here ask for a
            // sentence or two and stop long before this.
            max_tokens: request.maxTokens ?? 4096,
            system: request.system,
            messages: [
              {
                role: "user",
                content: request.image
                  ? [
                      // The image goes first: Anthropic documents better results when it
                      // precedes the question about it.
                      {
                        type: "image" as const,
                        source: splitDataUrl(request.image),
                      },
                      { type: "text" as const, text: request.prompt },
                    ]
                  : request.prompt,
              },
            ],
            // Rewriting a heading is not a reasoning problem, and an Author is watching the
            // text appear. Low effort keeps it quick and cheap.
            output_config: { effort: "low" },
          },
          { signal: idle.signal },
        );

        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            idle.bump();
            yield event.delta.text;
          }
        }
      } catch (cause) {
        if (idle.expired()) throw new ProviderError(options.name ?? "Anthropic", "stopped responding");
        if (cause instanceof Anthropic.APIError) {
          throw new ProviderError(options.name ?? "Anthropic", cause.message, cause.status);
        }
        // An abort is the Author changing their mind, not a provider failing — it must not
        // send the chain looking for a second opinion.
        if (cause instanceof Error && cause.name === "AbortError") throw cause;
        throw new ProviderError(options.name ?? "Anthropic", cause instanceof Error ? cause.message : "failed");
      } finally {
        // Whichever way the stream ended, the timer must not keep the process awake.
        idle.done();
      }
    },
  };
}

/** Turns `data:image/png;base64,AAA` into the shape the Messages API expects. */
function splitDataUrl(dataUrl: string): {
  type: "base64";
  media_type: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
  data: string;
} {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/);
  if (!match) throw new Error("An image must be a base64 data URL of a PNG, JPEG, WebP or GIF.");
  return {
    type: "base64",
    media_type: match[1] as "image/png",
    data: match[2]!,
  };
}
