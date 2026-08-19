import { NextResponse } from "next/server";

import { storage } from "../../../lib/storage";

/**
 * Serves an uploaded file.
 *
 * A Site on the local disk has no other way to reach its uploads, and a Site on a private
 * bucket uses this rather than making the bucket public. A Site with a CDN domain never
 * reaches this route at all, because `storage().url()` points somewhere else.
 */
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;

  let found;
  try {
    found = await storage().get(key.join("/"));
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
