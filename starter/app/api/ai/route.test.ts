/**
 * How the assistant reports a failure that happens after the response has begun.
 *
 * By the time a provider can fail the status is already 200 and the headers are gone, so the
 * only channel left is the body — which means the Editor has to be able to tell "the model
 * said this" from "the request died". `ASSIST_ERROR`, a NUL, is that separator: Assist.tsx
 * splits on it, puts back whatever the field held before, and shows the rest as a message.
 *
 * This test exists because that repair was once only half-landed. The reading half was in
 * Assist.tsx and the route still enqueued `\n\n[reason]` as ordinary text, so the sentinel
 * was never sent, the split never matched, and an Author pressing Rewrite during a provider
 * outage got "[Every provider failed…]" written into their heading as publishable content.
 * The import of ASSIST_ERROR sat unused in the route for weeks and nothing failed.
 */

import { ASSIST_ERROR, NoProviderAvailable } from "@mimnets/core/ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

const streamMock = vi.fn();

vi.mock("../../../lib/session", () => ({
  requireUser: async () => ({ id: "person-1", email: "owner@example.com" }),
}));

vi.mock("../../../lib/ai", () => ({
  withinRateLimit: () => true,
  aiProvider: () => ({ name: "test", stream: streamMock }),
}));

const { POST } = await import("./route");

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/ai", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}

async function readAll(response: Response): Promise<string> {
  return await new Response(response.body).text();
}

beforeEach(() => {
  streamMock.mockReset();
});

describe("when every provider fails mid-stream", () => {
  beforeEach(() => {
    // eslint-disable-next-line require-yield
    streamMock.mockImplementation(async function* () {
      throw new NoProviderAvailable([
        { provider: "OpenRouter (free · llama-3.3-70b)", reason: "rate limited" },
        { provider: "Groq", reason: "no key" },
      ]);
    });
  });

  it("sends the sentinel rather than prose", async () => {
    const body = await readAll(await post({ action: "rewrite", input: "A heading" }));

    // Without this the Editor cannot tell a failure from the model's own output.
    expect(body).toContain(ASSIST_ERROR);
  });

  it("puts the reason after the sentinel, where the Editor reads it", async () => {
    const body = await readAll(await post({ action: "rewrite", input: "A heading" }));

    const at = body.indexOf(ASSIST_ERROR);
    expect(at).toBeGreaterThanOrEqual(0);
    expect(body.slice(at + ASSIST_ERROR.length)).toContain("Every provider failed");
  });

  it("does not send the reason as bracketed text an Author could publish", async () => {
    const body = await readAll(await post({ action: "rewrite", input: "A heading" }));

    // The exact shape of the old bug: a message formatted to be read, not to be parsed.
    expect(body).not.toContain("[Every provider failed");
  });
});

describe("when a provider fails after producing some output", () => {
  it("keeps the partial text and the sentinel separable", async () => {
    streamMock.mockImplementation(async function* () {
      yield "A better ";
      yield "heading";
      throw new Error("upstream closed");
    });

    const body = await readAll(await post({ action: "rewrite", input: "A heading" }));

    // Everything before the sentinel is what the model produced; everything after is the
    // report. The Editor discards both and restores the field, but it can only do that if
    // the boundary survives.
    const at = body.indexOf(ASSIST_ERROR);
    expect(body.slice(0, at)).toBe("A better heading");
    expect(body.slice(at + ASSIST_ERROR.length)).toBe("upstream closed");
  });
});

describe("when the Author cancels", () => {
  it("closes quietly, with no sentinel and no message", async () => {
    streamMock.mockImplementation(async function* () {
      const abort = new Error("aborted");
      abort.name = "AbortError";
      throw abort;
    });

    const body = await readAll(await post({ action: "rewrite", input: "A heading" }));

    // Changing your mind is not a failure and must not be reported as one.
    expect(body).toBe("");
  });
});

describe("a successful run", () => {
  it("streams the model's text and nothing else", async () => {
    streamMock.mockImplementation(async function* () {
      yield "A better ";
      yield "heading";
    });

    const body = await readAll(await post({ action: "rewrite", input: "A heading" }));

    expect(body).toBe("A better heading");
    expect(body).not.toContain(ASSIST_ERROR);
  });
});
