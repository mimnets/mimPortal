import "dotenv/config";

import { eq } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { createDatabase, media } from "@mimnets/core/db";

import { replyToFor } from "./forms";

/**
 * What `/media` will and will not hand out.
 *
 * The route is unauthenticated on purpose — these are the images on published Pages and a
 * visitor has no account. What it must not be is a window onto the whole bucket. It used to
 * proxy any key the storage adapter would accept, which made the Site's own advice to "use a
 * private bucket rather than a public one" a distinction without a difference: a bucket
 * holding backups or another service's objects was readable through here by anyone who named
 * a key.
 *
 * A key now has to name a row in `media` — a file this Site uploaded through its Dashboard.
 * These check that rule against the real table, which is the thing the route asks.
 *
 *   docker compose up -d db
 */
const url = process.env.DATABASE_URL;

const reachable = url ? await answers(url) : false;

async function answers(connectionString: string): Promise<boolean> {
  const client = postgres(connectionString, { max: 1, connect_timeout: 2, onnotice: () => {} });
  try {
    await client`select 1`;
    return true;
  } catch {
    return false;
  } finally {
    await client.end({ timeout: 2 }).catch(() => {});
  }
}

const suite = reachable ? describe : describe.skip;
const db = reachable ? createDatabase(url!) : null;

/** Exactly the lookup the route performs. */
async function isKnown(key: string): Promise<boolean> {
  const [row] = await db!.select({ id: media.id }).from(media).where(eq(media.key, key)).limit(1);
  return Boolean(row);
}

const KEY = `2026/09/test-media-guard-${crypto.randomUUID().slice(0, 8)}.png`;

afterAll(async () => {
  if (db) await db.delete(media).where(eq(media.key, KEY)).catch(() => {});
});

suite("which keys /media will serve", () => {
  it("serves a key this Site uploaded", async () => {
    await db!.insert(media).values({
      key: KEY,
      filename: "test.png",
      contentType: "image/png",
      size: 128,
    });

    expect(await isKnown(KEY)).toBe(true);
  });

  it("refuses a key that is in the bucket but was never uploaded here", async () => {
    // The shape of the problem: a bucket shared with something else. The object may exist
    // and the adapter would happily fetch it; the Site has no row for it, so it is a 404.
    expect(await isKnown("backups/2026-09-03/database.sql")).toBe(false);
    expect(await isKnown("another-service/customers.csv")).toBe(false);
  });

  it("refuses a key that does not exist anywhere", async () => {
    expect(await isKnown("nothing/at/all.png")).toBe(false);
  });

  it("matches the whole key, not a prefix of it", async () => {
    await db!.insert(media).values({
      key: KEY.replace(".png", "-second.png"),
      filename: "second.png",
      contentType: "image/png",
      size: 64,
    });

    // A row whose key merely starts the same way must not admit a different object.
    expect(await isKnown(KEY.replace(".png", ""))).toBe(false);

    await db!.delete(media).where(eq(media.key, KEY.replace(".png", "-second.png")));
  });
});

/**
 * The address a notification is answered to is typed by whoever filled in the form, and it
 * lands in a mail header. A header is line-delimited, so an interior CRLF is how somebody
 * asked only for an email address writes a second header.
 */
describe("what may become a reply-to address", () => {
  it("passes an ordinary address through", () => {
    expect(replyToFor("someone@example.com")).toBe("someone@example.com");
  });

  it("refuses an address with a newline inside it", () => {
    for (const attempt of [
      "someone@example.com\r\nBcc: everyone@example.com",
      "someone@example.com\nBcc: everyone@example.com",
      "a\rb@example.com",
      "someone@exa\nmple.com",
    ]) {
      expect(replyToFor(attempt)).toBeUndefined();
    }
  });

  /**
   * The case that caught a gap in the first version of this fix.
   *
   * `looksLikeEmail` trims before testing, so a trailing CRLF passes the check — and the
   * guard was being applied to the value while the *untrimmed* original was what got sent.
   * The string that is validated has to be the string that leaves.
   */
  it("never returns the whitespace it validated away", () => {
    for (const attempt of [
      "someone@example.com\r\n",
      "  someone@example.com  ",
      "someone@example.com\n",
      "\tsomeone@example.com",
    ]) {
      expect(replyToFor(attempt)).toBe("someone@example.com");
    }
  });

  it("refuses what was never an address", () => {
    for (const attempt of ["", "not an address", "@example.com", "someone@", "someone@example"]) {
      expect(replyToFor(attempt)).toBeUndefined();
    }
  });
});
