import { describe, expect, it } from "vitest";

import { FORM_FIELDS, safeReturnPath } from "./shared";
import {
  elapsedSince,
  hashIp,
  honeypotSignal,
  rateLimitSignal,
  runSpamChecks,
  signRenderedAt,
  timingSignal,
  type SpamCheckInput,
} from "./spam";

const SECRET = "a-test-signing-secret";

function submission(overrides: Partial<SpamCheckInput> = {}): SpamCheckInput {
  return {
    fields: { name: "Ada", email: "ada@example.com", message: "Hello" },
    elapsedMs: 30_000,
    ipHash: "hash",
    recentFromIp: async () => 0,
    ...overrides,
  };
}

describe("the honeypot", () => {
  it("lets a person through", async () => {
    expect(await honeypotSignal().check(submission())).toBeNull();
  });

  it("lets an explicitly empty field through", async () => {
    // A browser that submits every named input sends "", which is not a bot.
    const fields = { [FORM_FIELDS.honeypot]: "   " };
    expect(await honeypotSignal().check(submission({ fields }))).toBeNull();
  });

  it("catches anything that filled it in", async () => {
    const fields = { [FORM_FIELDS.honeypot]: "https://buy-pills.example" };
    expect(await honeypotSignal().check(submission({ fields }))).toMatch(/left empty/);
  });
});

describe("the timing check", () => {
  it("accepts a form that took a while to fill in", async () => {
    expect(await timingSignal().check(submission({ elapsedMs: 30_000 }))).toBeNull();
  });

  it("rejects a submission faster than anyone could read the form", async () => {
    expect(await timingSignal().check(submission({ elapsedMs: 200 }))).toMatch(/too quickly/);
  });

  it("rejects a form left open for a day", async () => {
    const elapsedMs = 25 * 60 * 60 * 1000;
    expect(await timingSignal().check(submission({ elapsedMs }))).toMatch(/too long/);
  });

  it("treats a missing timestamp as suspicious, not as fine", async () => {
    // The stamp is signed, so arriving without one means the request was built by hand.
    expect(await timingSignal().check(submission({ elapsedMs: null }))).toMatch(/timestamp/);
  });

  it("respects a Site that wants a different threshold", async () => {
    const strict = timingSignal({ minimumMs: 10_000 });
    expect(await strict.check(submission({ elapsedMs: 5_000 }))).toMatch(/too quickly/);
  });
});

describe("the signed timestamp", () => {
  it("measures how long the form was open", () => {
    const rendered = 1_000_000;
    const stamp = signRenderedAt(rendered, SECRET);
    expect(elapsedSince(stamp, SECRET, rendered + 5_000)).toBe(5_000);
  });

  it("refuses a timestamp somebody edited", () => {
    // This is the whole reason it is signed: otherwise a bot reads the hidden field and
    // writes back whatever value passes the check.
    const stamp = signRenderedAt(1_000_000, SECRET);
    const forged = stamp.replace(/^\d+/, "900000");
    expect(elapsedSince(forged, SECRET, 1_005_000)).toBeNull();
  });

  it("refuses a timestamp signed with a different Site's secret", () => {
    const stamp = signRenderedAt(1_000_000, "another-sites-secret");
    expect(elapsedSince(stamp, SECRET, 1_005_000)).toBeNull();
  });

  it("refuses a stamp with no signature at all", () => {
    expect(elapsedSince("1000000", SECRET, 1_005_000)).toBeNull();
    expect(elapsedSince("", SECRET, 1_005_000)).toBeNull();
    expect(elapsedSince(undefined, SECRET, 1_005_000)).toBeNull();
  });

  it("refuses a signature of the wrong length without throwing", () => {
    // timingSafeEqual throws on a length mismatch, which would turn a malformed request
    // into a 500 rather than a rejection.
    expect(() => elapsedSince("1000000.short", SECRET, 1_005_000)).not.toThrow();
    expect(elapsedSince("1000000.short", SECRET, 1_005_000)).toBeNull();
  });

  it("refuses a valid signature over something that is not a number", () => {
    const stamp = signRenderedAt(NaN as unknown as number, SECRET);
    expect(elapsedSince(stamp, SECRET, 1_005_000)).toBeNull();
  });
});

describe("the rate limit", () => {
  it("allows a sender under the ceiling", async () => {
    const signal = rateLimitSignal({ max: 5 });
    expect(await signal.check(submission({ recentFromIp: async () => 4 }))).toBeNull();
  });

  it("stops a sender at the ceiling", async () => {
    const signal = rateLimitSignal({ max: 5 });
    expect(await signal.check(submission({ recentFromIp: async () => 5 }))).toMatch(/More than 5/);
  });
});

describe("hashing a sender", () => {
  it("is stable, so a rate limit can count", () => {
    expect(hashIp("203.0.113.9", SECRET)).toBe(hashIp("203.0.113.9", SECRET));
  });

  it("tells two senders apart", () => {
    expect(hashIp("203.0.113.9", SECRET)).not.toBe(hashIp("203.0.113.10", SECRET));
  });

  it("does not contain the address it was made from", () => {
    // The point is to count senders without keeping a table of who wrote in.
    expect(hashIp("203.0.113.9", SECRET)).not.toContain("203.0.113.9");
  });

  it("differs between Sites, so hashes cannot be correlated across them", () => {
    expect(hashIp("203.0.113.9", SECRET)).not.toBe(hashIp("203.0.113.9", "other-secret"));
  });
});

describe("running the checks", () => {
  const signals = [honeypotSignal(), timingSignal(), rateLimitSignal({ max: 2 })];

  it("accepts a genuine submission", async () => {
    expect(await runSpamChecks(signals, submission())).toEqual({ rejected: false });
  });

  it("names which check objected, for the log", async () => {
    const fields = { [FORM_FIELDS.honeypot]: "spam" };
    const verdict = await runSpamChecks(signals, submission({ fields }));
    expect(verdict.rejected).toBe(true);
    expect(verdict.signal).toBe("honeypot");
  });

  it("stops at the first objection without paying for the later ones", async () => {
    let queried = false;
    const verdict = await runSpamChecks(signals, {
      ...submission({ fields: { [FORM_FIELDS.honeypot]: "spam" } }),
      recentFromIp: async () => {
        queried = true;
        return 0;
      },
    });
    expect(verdict.rejected).toBe(true);
    // The honeypot is free and the rate limit reads the database; order is the saving.
    expect(queried).toBe(false);
  });

  it("accepts everything when a Site removes every check", async () => {
    // Pluggable means a Site can also plug nothing in, and that must not fail closed.
    expect(await runSpamChecks([], submission({ elapsedMs: null }))).toEqual({ rejected: false });
  });

  it("lets a Site add a check of its own", async () => {
    const noLinks = {
      name: "no links",
      check: ({ fields }: SpamCheckInput) =>
        (fields.message ?? "").includes("http") ? "The message contains a link." : null,
    };
    const verdict = await runSpamChecks([...signals, noLinks], {
      ...submission(),
      fields: { message: "see http://spam.example" },
    });
    expect(verdict.signal).toBe("no links");
  });
});

describe("where a submission sends the visitor back to", () => {
  it("keeps an ordinary path", () => {
    expect(safeReturnPath("/contact")).toBe("/contact");
    expect(safeReturnPath("/")).toBe("/");
    expect(safeReturnPath("/a/deep/page")).toBe("/a/deep/page");
  });

  it("refuses an absolute URL", () => {
    // Otherwise the Site's own endpoint bounces whoever submitted the form onto a domain
    // chosen by whoever crafted the request — the field is a hidden input, so anybody can.
    expect(safeReturnPath("https://evil.example/phish")).toBe("/");
    expect(safeReturnPath("http://evil.example")).toBe("/");
  });

  it("refuses the protocol-relative forms a browser also treats as absolute", () => {
    expect(safeReturnPath("//evil.example/phish")).toBe("/");
    expect(safeReturnPath("/\\evil.example")).toBe("/");
  });

  it("refuses anything that is not a path at all", () => {
    expect(safeReturnPath("javascript:alert(1)")).toBe("/");
    expect(safeReturnPath("contact")).toBe("/");
    expect(safeReturnPath("")).toBe("/");
  });
});
