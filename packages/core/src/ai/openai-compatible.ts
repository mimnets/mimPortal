import { ProviderError, type AiProvider, type AiRequest } from "./provider";

/**
 * OpenRouter, OpenAI and DeepSeek.
 *
 * All three speak the same `/chat/completions` request and the same `data:` streaming
 * format, so they are one adapter with three base URLs rather than three near-identical
 * files. None of them has an SDK worth adding for one endpoint — the whole surface used here
 * is a POST and a line parser.
 *
 * OpenRouter is the reason this exists: it fronts a catalogue that includes genuinely free
 * models, which is what lets a Site have a working assistant before anybody has entered a
 * card (ADR-0014).
 */
export function openAiCompatibleProvider(options: {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  free?: boolean;
  vision?: boolean;
  /** OpenRouter asks for these so it can attribute traffic. Harmless elsewhere. */
  headers?: Record<string, string>;
}): AiProvider {
  const endpoint = `${options.baseUrl.replace(/\/+$/, "")}/chat/completions`;

  return {
    name: options.name,
    model: options.model,
    free: options.free ?? false,
    vision: options.vision ?? false,

    async *stream(request: AiRequest) {
      let response: Response;

      try {
        response = await fetch(endpoint, {
          method: "POST",
          signal: request.signal,
          headers: {
            authorization: `Bearer ${options.apiKey}`,
            "content-type": "application/json",
            ...options.headers,
          },
          body: JSON.stringify({
            model: options.model,
            stream: true,
            max_tokens: request.maxTokens ?? 4096,
            messages: [
              { role: "system", content: request.system },
              {
                role: "user",
                // A plain string when there is no image, because some endpoints reject the
                // array form outright and every one of them accepts a string.
                content: request.image
                  ? [
                      { type: "text", text: request.prompt },
                      { type: "image_url", image_url: { url: request.image } },
                    ]
                  : request.prompt,
              },
            ],
            ...(request.json ? { response_format: { type: "json_object" } } : {}),
          }),
        });
      } catch (cause) {
        if (cause instanceof Error && cause.name === "AbortError") throw cause;
        throw new ProviderError(options.name, cause instanceof Error ? cause.message : "unreachable");
      }

      if (!response.ok || !response.body) {
        // The body carries which model was rejected or which quota ran out, and a free
        // model that has been retired says so here. A bare status leaves nobody able to fix it.
        const detail = await response.text().catch(() => "");
        throw new ProviderError(options.name, detail.slice(0, 300) || "no response body", response.status);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Events are separated by a blank line, and a chunk can split one anywhere —
          // including in the middle of a UTF-8 character, which is why the decoder streams.
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";

          for (const event of events) {
            for (const line of event.split("\n")) {
              if (!line.startsWith("data:")) continue;

              const payload = line.slice(5).trim();
              if (payload === "" || payload === "[DONE]") continue;

              let parsed: { choices?: { delta?: { content?: string } }[]; error?: { message?: string } };
              try {
                parsed = JSON.parse(payload);
              } catch {
                // A malformed frame is the provider's problem, not a reason to stop reading.
                continue;
              }

              // OpenRouter reports a model failing mid-stream in-band, with HTTP 200.
              if (parsed.error) {
                throw new ProviderError(options.name, parsed.error.message ?? "stream error");
              }

              const text = parsed.choices?.[0]?.delta?.content;
              if (text) yield text;
            }
          }
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
    },
  };
}

/** OpenRouter's catalogue, including the models it serves at no cost. */
export function openRouterProvider(options: {
  apiKey: string;
  model: string;
  free?: boolean;
  vision?: boolean;
  /** Sent as the attribution headers OpenRouter asks integrations to set. */
  siteUrl?: string;
  siteName?: string;
}): AiProvider {
  return openAiCompatibleProvider({
    name: options.free ? `OpenRouter (free · ${options.model})` : `OpenRouter (${options.model})`,
    baseUrl: "https://openrouter.ai/api/v1",
    apiKey: options.apiKey,
    model: options.model,
    free: options.free,
    vision: options.vision,
    headers: {
      ...(options.siteUrl ? { "http-referer": options.siteUrl } : {}),
      ...(options.siteName ? { "x-title": options.siteName } : {}),
    },
  });
}

export function openAiProvider(options: { apiKey: string; model?: string }): AiProvider {
  return openAiCompatibleProvider({
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    apiKey: options.apiKey,
    model: options.model ?? "gpt-5",
    vision: true,
  });
}

export function deepSeekProvider(options: { apiKey: string; model?: string }): AiProvider {
  return openAiCompatibleProvider({
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    apiKey: options.apiKey,
    model: options.model ?? "deepseek-chat",
  });
}
