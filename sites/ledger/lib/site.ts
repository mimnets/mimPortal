import { eq } from "drizzle-orm";
import { menuItemsSchema, type RenderContext } from "@mimnets/core";
import { createDatabase, menus, siteSettings } from "@mimnets/core/db";

import { signRenderedAt } from "@mimnets/core/forms";

import { authSecret, requireDatabaseUrl } from "./env";
import { storage } from "./storage";

/**
 * Resolves everything a Page's Blocks can read, once per request.
 *
 * Blocks never query anything themselves — a Menu Block holds a slug, not a copy of the
 * links — so this is where Menus stop being rows and start being renderable.
 */
export async function renderContext(
  currentPath: string,
  query: Record<string, string> = {},
): Promise<RenderContext> {
  const db = createDatabase(requireDatabaseUrl());

  const [settings] = await db
    .select({ siteName: siteSettings.siteName })
    .from(siteSettings)
    .where(eq(siteSettings.id, "singleton"))
    .limit(1);

  const rows = await db.select().from(menus);

  const resolved: RenderContext["menus"] = {};
  for (const row of rows) {
    // A Menu whose items fail validation renders as empty rather than breaking the Page it
    // appears on, which on a Header would be every Page at once.
    const parsed = menuItemsSchema.safeParse(row.items);
    resolved[row.slug] = parsed.success ? parsed.data : [];
  }

  return {
    siteName: settings?.siteName ?? "",
    menus: resolved,
    currentPath,
    // Blocks hold storage keys; this is what turns one into something a browser can fetch.
    mediaBaseUrl: storage().baseUrl,
    // Stamped per request, so the timing check measures this render rather than a cached one.
    formToken: signRenderedAt(Date.now(), authSecret()),
    query,
  };
}
