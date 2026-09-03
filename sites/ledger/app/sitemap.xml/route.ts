import { isNotNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDatabase, pages } from "@mimnets/core/db";

import { baseUrl, requireDatabaseUrl } from "../../lib/env";

/**
 * Every Page a visitor can actually reach, and nothing else.
 *
 * The filter is `publishedLayout is not null`, the same condition the public route uses to
 * decide whether a Page exists. A sitemap listing drafts invites a search engine to index
 * a 404 and tells it the Site is unreliable.
 */
export const dynamic = "force-dynamic";

function escape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET() {
  const db = createDatabase(requireDatabaseUrl());
  const rows = await db
    .select({ path: pages.path, updatedAt: pages.updatedAt })
    .from(pages)
    .where(isNotNull(pages.publishedLayout));

  const origin = baseUrl();
  const entries = rows
    .map(
      (row) =>
        `  <url>\n` +
        `    <loc>${escape(new URL(row.path, origin).toString())}</loc>\n` +
        `    <lastmod>${row.updatedAt.toISOString()}</lastmod>\n` +
        `  </url>`,
    )
    .join("\n");

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;

  return new NextResponse(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      // Short, not immutable: publishing a Page should show up in a crawl today.
      "cache-control": "public, max-age=300",
    },
  });
}
