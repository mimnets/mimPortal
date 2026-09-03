import { eq, sql } from "drizzle-orm";
import { createDatabase, siteSettings } from "@mimnets/core/db";

import { databaseUrl } from "./env";

/**
 * The installer's state machine (ADR-0010).
 *
 * `provisioning` — no usable database is configured. The installer asks for one. Only
 * reachable on infrastructure with a writable filesystem, which rules out most managed hosting.
 * `onboarding`  — a database exists but nobody has installed the Site. The installer creates
 * the first Owner and names the Site, and never touches database configuration.
 * `installed`   — every /install route refuses to run, permanently.
 * `unavailable` — a database is configured but cannot be reached. Nothing about the Site can
 * be decided, so every install route refuses rather than guessing.
 */
export type InstallMode = "provisioning" | "onboarding" | "installed" | "unavailable";

export async function installMode(): Promise<InstallMode> {
  const url = databaseUrl();
  if (!url) return "provisioning";

  const db = createDatabase(url);

  // Reachability is asked separately from installation, because the two must not share a
  // failure mode. A configured database that is briefly down is not a Site waiting to be
  // provisioned, and reporting it as one re-opens an installer that accepts a connection
  // string from anybody.
  try {
    await db.execute(sql`select 1`);
  } catch {
    return "unavailable";
  }

  try {
    const [settings] = await db
      .select({ installedAt: siteSettings.installedAt })
      .from(siteSettings)
      .where(eq(siteSettings.id, "singleton"))
      .limit(1);

    return settings?.installedAt ? "installed" : "onboarding";
  } catch {
    // Reachable, but the schema is not there — migrations have never been applied, and
    // provisioning is what applies them.
    return "provisioning";
  }
}

export async function isInstalled(): Promise<boolean> {
  return (await installMode()) === "installed";
}

/**
 * Whether the sign-up endpoint answers at all.
 *
 * Onboarding is the only window in which an account is created over HTTP, and it is asked
 * for positively: an unreachable database must close sign-up, not open it.
 */
export async function signUpOpen(): Promise<boolean> {
  return (await installMode()) === "onboarding";
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
