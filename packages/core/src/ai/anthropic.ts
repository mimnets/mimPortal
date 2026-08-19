import Anthropic from "@anthropic-ai/sdk";

import { ProviderError, type AiProvider, type AiRequest } from "./provider";

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
}): AiProvider {
  const model = options.model ?? "claude-opus-5";
  const client = new Anthropic({ apiKey: options.apiKey });

  return {
    name: "Anthropic",
    model,
    free: options.free ?? false,

    async *stream(request: AiRequest) {
      try {
        const stream = client.messages.stream(
          {
            model,
            // Streaming, so there is room to be generous; the prompts here ask for a
            // sentence or two and stop long before this.
            max_tokens: request.maxTokens ?? 4096,
            system: request.system,
            messages: [{ role: "user", content: request.prompt }],
            // Rewriting a heading is not a reasoning problem, and an Author is watching the
            // text appear. Low effort keeps it quick and cheap.
            output_config: { effort: "low" },
          },
          { signal: request.signal },
        );

        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            yield event.delta.text;
          }
        }
      } catch (cause) {
        if (cause instanceof Anthropic.APIError) {
          throw new ProviderError("Anthropic", cause.message, cause.status);
        }
        // An abort is the Author changing their mind, not a provider failing — it must not
        // send the chain looking for a second opinion.
        if (cause instanceof Error && cause.name === "AbortError") throw cause;
        throw new ProviderError("Anthropic", cause instanceof Error ? cause.message : "failed");
      }
    },
  };
}
