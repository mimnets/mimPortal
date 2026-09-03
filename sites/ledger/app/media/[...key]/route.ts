import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDatabase, media } from "@mimnets/core/db";

import { requireDatabaseUrl } from "../../../lib/env";
import { storage } from "../../../lib/storage";

/**
 * Serves an uploaded file.
 *
 * A Site on the local disk has no other way to reach its uploads, and a Site on a private
 * bucket uses this rather than making the bucket public. A Site with a CDN domain never
 * reaches this route at all, because `storage().url()` points somewhere else.
 *
 * Deliberately unauthenticated: these are the images on published Pages, and a visitor has
 * no account. What it is *not* is a window onto the whole bucket. The key has to name a row
 * in `media` — a file this Site uploaded through its own Dashboard — so a bucket that also
 * holds backups, exports, or another service's objects does not become readable through
 * here. That was the gap: the route proxied any key the storage adapter would accept, which
 * made "use a private bucket rather than a public one" a distinction without a difference.
 *
 * The lookup costs one indexed read per request. `media.key` is unique, and the response is
 * immutable, so a browser or CDN asks once.
 */
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const path = key.join("/");

  const db = createDatabase(requireDatabaseUrl());
  const [known] = await db.select({ id: media.id }).from(media).where(eq(media.key, path)).limit(1);

  // A key this Site did not upload is a 404, the same as one that does not exist. Saying
  // "that file is not ours" would confirm the bucket holds it.
  if (!known) return new NextResponse("Not found", { status: 404 });

  let found;
  try {
    found = await storage().get(path);
  } catch {
    // An unsafe key is a 404, not a 500: saying "that path is invalid" describes the guard
    // to whoever was probing it.
    return new NextResponse("Not found", { status: 404 });
  }

  if (!found) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(found.body as unknown as BodyInit, {
    headers: {
      "content-type": found.contentType,
      "content-length": String(found.body.byteLength),
      // Keys are unique per upload and never reused, so a file at a key never changes.
      "cache-control": "public, max-age=31536000, immutable",
      // Uploads are attacker-controlled bytes served from the Site's own origin.
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "x-content-type-options": "nosniff",
    },
  });
}
