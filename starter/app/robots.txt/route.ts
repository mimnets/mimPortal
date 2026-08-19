import { NextResponse } from "next/server";

import { baseUrl } from "../../lib/env";

/**
 * The Dashboard is disallowed rather than merely unlinked. It is already behind a login, so
 * this is not a security measure — it stops a crawler wasting a Site's crawl budget on a
 * sign-in form and indexing it as a page of the Site.
 */
export const dynamic = "force-dynamic";

export function GET() {
  const body = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /install",
    "",
    `Sitemap: ${new URL("/sitemap.xml", baseUrl()).toString()}`,
    "",
  ].join("\n");

  return new NextResponse(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
