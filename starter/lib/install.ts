import { eq } from "drizzle-orm";
import { createDatabase, siteSettings } from "@mimnets/core/db";

import { databaseUrl } from "./env";

/**
 * The installer's state machine (ADR-0010).
 *
 * `provisioning` — no database is configured. The installer asks for one. Only reachable on
 * infrastructure with a writable filesystem, which rules out most managed hosting.
 * `onboarding` — a database exists but nobody has installed the Site. The installer creates
 * the first Owner and names the Site, and never touches database configuration.
 * `installed`  — every /install route refuses to run, permanently.
 */
export type InstallMode = "provisioning" | "onboarding" | "installed";

export async function installMode(): Promise<InstallMode> {
  const url = databaseUrl();
  if (!url) return "provisioning";

  try {
    const db = createDatabase(url);
    const [settings] = await db
      .select({ installedAt: siteSettings.installedAt })
      .from(siteSettings)
      .where(eq(siteSettings.id, "singleton"))
      .limit(1);

    return settings?.installedAt ? "installed" : "onboarding";
  } catch {
    // Unreachable database, or migrations never applied. Either way the Site is not
    // installed, and the installer is where that gets fixed.
    return "provisioning";
  }
}

export async function isInstalled(): Promise<boolean> {
  return (await installMode()) === "installed";
}

/**
 * The one-time token that gates onboarding. Anyone who reaches an uninstalled Site before
 * its Owner does could otherwise claim it, so the token is generated on first contact and
 * printed to the server log for the Owner to pass on with the link.
 */
export async function ensureInstallToken(): Promise<string> {
  const db = createDatabase(databaseUrl()!);

  const [existing] = await db
    .select({ token: siteSettings.installToken })
    .from(siteSettings)
    .where(eq(siteSettings.id, "singleton"))
    .limit(1);

  if (existing?.token) return existing.token;

  const token = crypto.randomUUID();

  if (existing) {
    await db
      .update(siteSettings)
      .set({ installToken: token })
      .where(eq(siteSettings.id, "singleton"));
  } else {
    await db.insert(siteSettings).values({ id: "singleton", installToken: token });
  }

  console.info(`\n  Mimnets install token: ${token}\n  Open /install and enter it to claim this Site.\n`);
  return token;
}
