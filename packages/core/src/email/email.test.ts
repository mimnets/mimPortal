import { beforeEach, describe, expect, it } from "vitest";

import { looksLikeEmail, unconfiguredEmail } from "./adapter";
import { resendEmail } from "./resend";
import { smtpEmail } from "./smtp";

/**
 * The SMTP adapter against a real mail server, because what is worth proving is that a
 * message leaves — and a mock transport would prove only that nodemailer was called.
 *
 *   docker compose --profile mail up -d mail
 *
 * Mailpit accepts everything and delivers nothing, and its inbox is readable over HTTP.
 * Skipped, not failed, when the container is not running.
 */
const inbox = process.env.SMTP_TEST_API ?? "http://localhost:8025";
const host = process.env.SMTP_TEST_HOST ?? "localhost";
const port = Number(process.env.SMTP_TEST_PORT ?? 1025);

const reachable = await fetch(`${inbox}/api/v1/messages`, { signal: AbortSignal.timeout(1500) })
  .then((response) => response.ok)
  .catch(() => false);

const suite = reachable ? describe : describe.skip;

async function clearInbox() {
  await fetch(`${inbox}/api/v1/messages`, { method: "DELETE" });
}

async function latest() {
  const list = await fetch(`${inbox}/api/v1/messages`).then((r) => r.json());
  const first = list.messages?.[0];
  if (!first) return null;
  return fetch(`${inbox}/api/v1/message/${first.ID}`).then((r) => r.json());
}

describe("recognising an email address", () => {
  it("accepts an ordinary one", () => {
    expect(looksLikeEmail("ada@example.com")).toBe(true);
    expect(looksLikeEmail("  ada+tag@sub.example.co.uk  ")).toBe(true);
  });

  it("rejects what is obviously not one", () => {
    // Only enough to catch a mistyped recipient before an adapter is asked to send it.
    for (const value of ["ada", "ada@", "@example.com", "ada example.com", ""]) {
      expect(looksLikeEmail(value)).toBe(false);
    }
  });
});

describe("a Site with no email configured", () => {
  it("accepts the message rather than throwing", async () => {
    // A contact form must not fail because nobody has set up mail yet; the enquiry is
    // already saved by the time this is called.
    const adapter = unconfiguredEmail();
    await expect(
      adapter.send({ to: "owner@example.com", subject: "Hello", text: "Hi" }),
    ).resolves.toBeUndefined();
  });

  it("says it is not configured, so the Dashboard can too", () => {
    expect(unconfiguredEmail().configured).toBe(false);
  });
});

describe("the Resend adapter", () => {
  it("refuses a recipient that is not an address, before any request", async () => {
    const adapter = resendEmail({ apiKey: "re_not_a_real_key", from: "Acme <a@acme.com>" });
    await expect(
      adapter.send({ to: "not-an-address", subject: "x", text: "x" }),
    ).rejects.toThrow(/is not an email address/);
  });

  it("reports itself as configured", () => {
    expect(resendEmail({ apiKey: "k", from: "a@b.com" }).configured).toBe(true);
  });
});

suite("the SMTP adapter against a real mail server", () => {
  const adapter = smtpEmail({
    host,
    port,
    user: "anything",
    password: "anything",
    from: "Mimnets <hello@example.com>",
    secure: false,
  });

  beforeEach(clearInbox);

  it("delivers a message with its subject and body intact", async () => {
    await adapter.send({
      to: "owner@example.com",
      subject: "New enquiry from Acme",
      text: "Ada wrote in about a quote.",
    });

    const message = await latest();
    expect(message.Subject).toBe("New enquiry from Acme");
    expect(message.To[0].Address).toBe("owner@example.com");
    expect(message.From.Address).toBe("hello@example.com");
    expect(message.Text.trim()).toBe("Ada wrote in about a quote.");
  });

  it("sets reply-to, so answering an enquiry reaches whoever wrote in", async () => {
    // Without this, replying to a notification writes back to the Site's own address and
    // the customer never hears anything.
    await adapter.send({
      to: "owner@example.com",
      subject: "New enquiry",
      text: "Body",
      replyTo: "ada@example.com",
    });

    const message = await latest();
    expect(message.ReplyTo[0].Address).toBe("ada@example.com");
  });

  it("sends an HTML alternative alongside the text when given one", async () => {
    await adapter.send({
      to: "owner@example.com",
      subject: "Both",
      text: "plain version",
      html: "<p>rich version</p>",
    });

    const message = await latest();
    expect(message.Text.trim()).toBe("plain version");
    expect(message.HTML).toContain("rich version");
  });

  it("refuses a recipient that is not an address", async () => {
    await expect(adapter.send({ to: "nobody", subject: "x", text: "x" })).rejects.toThrow(
      /is not an email address/,
    );
  });

  it("fails loudly when the server cannot be reached", async () => {
    // A silent failure here is an enquiry nobody is told about, which is the failure mode
    // the Dashboard exists to catch — but it still has to surface as an error.
    const broken = smtpEmail({
      host: "127.0.0.1",
      port: 1,
      user: "u",
      password: "p",
      from: "a@b.com",
      secure: false,
    });
    await expect(broken.send({ to: "owner@example.com", subject: "x", text: "x" })).rejects.toThrow();
  });
});
