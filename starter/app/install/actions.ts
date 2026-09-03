"use server";

import { writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";

import { eq } from "drizzle-orm";
import { createDatabase, siteSettings, user } from "@mimnets/core/db";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { auth } from "../../lib/auth";
import { databaseUrl } from "../../lib/env";
import { installMode, type InstallMode } from "../../lib/install";

/**
 * Both installer modes refuse to run unless the Site is actually in that mode.
 *
 * The check is a database read rather than a file on disk, so a redeploy cannot resurrect
 * the installer (ADR-0010). It is asked positively — "is this Site in the mode this action
 * belongs to?" — because the negative form fails open: an unreachable database used to read
 * as `provisioning`, which handed an unauthenticated `provisionDatabase` to anybody who
 * caught the Site during an outage.
 */
async function assertMode(expected: InstallMode): Promise<void> {
  const mode = await installMode();
  if (mode === expected) return;

  if (mode === "installed") throw new Error("This Site is already installed.");
  if (mode === "unavailable") {
    throw new Error("The Site's database cannot be reached. The installer stays closed until it can.");
  }
  throw new Error("The installer is not at that step.");
}

/**
 * Provisioning mode: accept a database, prove it works, apply the schema, and write the
 * configuration to disk. The server has to be restarted afterwards because the connection
 * string is read from the environment at boot.
 */
export async function provisionDatabase(connectionString: string): Promise<{ restart: true }> {
  // This action is unauthenticated by necessity — nobody has an account yet — so the mode is
  // the whole of its protection. A Site that already has a working database is never in
  // provisioning mode, and so can never be repointed at somebody else's.
  await assertMode("provisioning");

  const url = connectionString.trim();
  if (!/^postgres(ql)?:\/\//.test(url)) {
    throw new Error("A Postgres connection string starts with postgres:// or postgresql://.");
  }

  const client = postgres(url, { max: 1, connect_timeout: 15 });
  try {
    await client`select 1`;
    await migrate(drizzle(client), { migrationsFolder: join(process.cwd(), "drizzle") });
  } catch (cause) {
    // The reason is logged, never returned: an unauthenticated caller who is told exactly why
    // a connection failed has been handed an outbound port scanner.
    console.error(`[mimnets] Provisioning rejected a database: ${cause instanceof Error ? cause.message : cause}`);
    throw new Error("Could not use that database. The reason is in the server log.");
  } finally {
    await client.end({ timeout: 5 }).catch(() => {});
  }

  const envPath = join(process.cwd(), ".env");
  const existing = await readFile(envPath, "utf8").catch(() => "");
  const kept = existing
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "" && !/^(DATABASE_URL|AUTH_SECRET)=/.test(line));

  // A Site that boots without a signing secret refuses to start, so one is generated here
  // rather than left for the Owner to discover later.
  const secret = /^AUTH_SECRET=(.+)$/m.exec(existing)?.[1] ?? crypto.randomUUID().replaceAll("-", "");

  await writeFile(envPath, [...kept, `DATABASE_URL=${url}`, `AUTH_SECRET=${secret}`].join("\n") + "\n");

  return { restart: true };
}

/**
 * Onboarding mode: name the Site and create its first Owner. This mode never sees database
 * configuration, which is what makes it safe to hand to a client.
 */
export async function completeInstall(input: {
  token: string;
  siteName: string;
  name: string;
  email: string;
  password: string;
}): Promise<void> {
  await assertMode("onboarding");

  const url = databaseUrl();
  if (!url) throw new Error("No database is configured yet.");

  const db = createDatabase(url);
  const [settings] = await db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.id, "singleton"))
    .limit(1);

  if (!settings?.installToken || settings.installToken !== input.token.trim()) {
    throw new Error("That install token is not right. It is printed in the server log.");
  }

  if (input.password.length < 12) {
    throw new Error("Use a password of at least 12 characters.");
  }

  const created = await auth().api.signUpEmail({
    body: { name: input.name, email: input.email, password: input.password },
  });

  if (!created?.user) throw new Error("Could not create that account.");

  // The first account is the Owner. Later accounts default to Author.
  await db.update(user).set({ role: "owner" }).where(eq(user.id, created.user.id));

  await db
    .update(siteSettings)
    .set({
      siteName: input.siteName,
      installedAt: new Date(),
      installToken: null,
    })
    .where(eq(siteSettings.id, "singleton"));
}
