"use server";

import { and, eq } from "drizzle-orm";
import { createDatabase, pages } from "@mimnets/core/db";

import { registry } from "../../blocks.config";

/**
 * Saves a Page's draft layout.
 *
 * The layout is validated here, on the server, before it touches the database — the Editor
 * is a convenience, not the boundary. Roles are checked at M4; until then every caller is
 * treated as the Owner.
 */
export async function saveDraft(layout: unknown): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");

  const parsed = registry.parseLayout(layout);
  const db = createDatabase(url);

  await db
    .update(pages)
    .set({ draftLayout: parsed, updatedAt: new Date() })
    .where(and(eq(pages.path, "/"), eq(pages.locale, "en")));
}
