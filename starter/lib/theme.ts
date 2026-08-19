import { eq } from "drizzle-orm";
import { defineTheme, themeSchema, type Theme } from "@mimnets/core";
import { createDatabase, siteSettings } from "@mimnets/core/db";

import { databaseUrl } from "./env";

/**
 * Which Theme this Site is actually wearing.
 *
 * `theme.ts` is the Site's default and its version-controlled starting point. A Preset
 * applied from the Dashboard writes a Theme into the database, and that wins while it is
 * there — because applying a Preset has to work at runtime, and `theme.ts` is code that a
 * host with a read-only filesystem cannot be asked to rewrite.
 *
 * Removing the stored Theme returns the Site to its file, which is what "Reset to theme.ts"
 * does and why applying a Preset is never destructive.
 */
export async function activeTheme(fallback: Theme): Promise<Theme> {
  const url = databaseUrl();
  // The installer renders before a database exists, so this cannot require one.
  if (!url) return fallback;

  try {
    const [settings] = await createDatabase(url)
      .select({ theme: siteSettings.theme })
      .from(siteSettings)
      .where(eq(siteSettings.id, "singleton"))
      .limit(1);

    if (!settings?.theme) return fallback;

    // Validated on the way out as well as in. A stored Theme is compiled straight into CSS
    // custom properties, and the row could predate a change to what a Theme contains.
    const parsed = themeSchema.safeParse(settings.theme);
    if (!parsed.success) {
      console.error("[mimnets] The stored Theme is not valid; using theme.ts instead.");
      return fallback;
    }

    return defineTheme(parsed.data);
  } catch (cause) {
    // A Site whose database is briefly unreachable should render unstyled-but-correct
    // rather than not at all.
    console.error(`[mimnets] Could not read the stored Theme: ${String(cause)}`);
    return fallback;
  }
}
