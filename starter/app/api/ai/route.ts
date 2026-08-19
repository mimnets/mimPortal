import { NextResponse } from "next/server";
import { isAssistAction } from "@mimnets/core";
import { assistPrompt, NoProviderAvailable } from "@mimnets/core/ai";

import { aiProvider, withinRateLimit } from "../../../lib/ai";
import { requireUser } from "../../../lib/session";

/**
 * Where the Editor's assistant buttons go.
 *
 * A route handler rather than a server action, because the reply streams: an Author watching
 * a sentence appear is the difference between "it is working" and "it is broken". Server
 * actions return once.
 *
 * The API key never leaves this process. The Editor sends an action name and some text, and
 * gets text back — it has no idea which vendor answered, which is what makes the provider
 * chain replaceable (ADR-0014).
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // Signed in, always. Generation costs money, and an open endpoint is somebody else's bill.
  let person;
  try {
    person = await requireUser();
  } catch {
    return NextResponse.json({ error: "You are not signed in." }, { status: 401 });
  }

  if (!withinRateLimit(person.id)) {
    return NextResponse.json(
      { error: "That is a lot of requests at once. Wait a moment and try again." },
      { status: 429 },
    );
  }

  const provider = aiProvider();
  if (!provider) {
    return NextResponse.json(
      { error: "No AI provider is configured for this Site. See docs/AI.md." },
      { status: 501 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    action?: unknown;
    input?: unknown;
    fieldLabel?: unknown;
    pageTitle?: unknown;
    siteName?: unknown;
  } | null;

  if (!body || !isAssistAction(body.action)) {
    return NextResponse.json({ error: "That is not an action this Site offers." }, { status: 400 });
  }

  const input = typeof body.input === "string" ? body.input : "";
  // A whole Page pasted into a heading field would be an expensive accident.
  if (input.length > 8_000) {
    return NextResponse.json({ error: "That text is too long to work on." }, { status: 413 });
  }

  const { system, prompt } = assistPrompt(body.action, input, {
    fieldLabel: typeof body.fieldLabel === "string" ? body.fieldLabel : undefined,
    pageTitle: typeof body.pageTitle === "string" ? body.pageTitle : undefined,
    siteName: typeof body.siteName === "string" ? body.siteName : undefined,
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of provider.stream({
          system,
          prompt,
          // Cancelling in the browser aborts the upstream request, so an Author who changes
          // their mind stops paying for the rest of the sentence.
          signal: request.signal,
        })) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (cause) {
        if (cause instanceof Error && cause.name === "AbortError") {
          controller.close();
          return;
        }

        // The response has already begun, so the only way to report this is in the body.
        // The Editor shows whatever arrived and this line beneath it.
        const reason =
          cause instanceof NoProviderAvailable
            ? cause.message
            : cause instanceof Error
              ? cause.message
              : "The assistant failed.";
        console.error(`[mimnets] Assist failed: ${reason}`);
        controller.enqueue(encoder.encode(`\n\n[${reason}]`));
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      // Without this a proxy can hold the whole reply and defeat the point of streaming.
      "x-accel-buffering": "no",
    },
  });
}
