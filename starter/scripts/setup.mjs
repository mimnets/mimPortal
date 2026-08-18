#!/usr/bin/env node
/**
 * First-run setup for a Site.
 *
 * Finds a database, writes .env, applies migrations. Re-runnable: nothing here is
 * destructive without asking, and a Site that is already configured can be pointed
 * somewhere else by running it again.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

import postgres from "postgres";

const here = dirname(fileURLToPath(import.meta.url));
const starterDir = join(here, "..");
const repoRoot = join(starterDir, "..");
const envPath = join(starterDir, ".env");

const LOCAL_URL = "postgres://mimnets:mimnets@localhost:5432/mimnets";

let rlInstance = null;
/** Created on first use so this module can be imported by tests without opening stdin. */
const rl = {
  question(prompt) {
    rlInstance ??= createInterface({ input: process.stdin, output: process.stdout });
    return rlInstance.question(prompt);
  },
  close() {
    rlInstance?.close();
  },
};

const bold = (s) => `[1m${s}[0m`;
const dim = (s) => `[2m${s}[0m`;
const green = (s) => `[32m${s}[0m`;
const yellow = (s) => `[33m${s}[0m`;
const red = (s) => `[31m${s}[0m`;

function say(message = "") {
  console.log(message);
}

/** Runs a command, returning null instead of throwing when it is unavailable or fails. */
function tryRun(command, args, options = {}) {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      ...options,
    }).trim();
  } catch {
    return null;
  }
}

function dockerState() {
  const version = tryRun("docker", ["info", "--format", "{{.ServerVersion}}"]);
  if (version) return { installed: true, running: true, version };
  const installed = tryRun("docker", ["--version"]) !== null;
  return { installed, running: false, version: null };
}

function readExistingUrl() {
  if (!existsSync(envPath)) return null;
  const line = readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith("DATABASE_URL="));
  const value = line?.slice("DATABASE_URL=".length).trim();
  return value ? value : null;
}

function writeEnv(url) {
  const existing = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  const withoutUrl = existing
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "" && !l.startsWith("DATABASE_URL="))
    .join("\n");
  const body = [withoutUrl, `DATABASE_URL=${url}`].filter(Boolean).join("\n");
  writeFileSync(envPath, `${body}\n`, "utf8");
}

export function normaliseUrl(input) {
  const url = input.trim().replace(/^["']|["']$/g, "");
  const isLocal = /@(localhost|127\.0\.0\.1|db)[:/]/.test(url);
  if (isLocal || url.includes("sslmode=")) return url;
  return url.includes("?") ? `${url}&sslmode=require` : `${url}?sslmode=require`;
}

/** Explains the common wrong pastes rather than failing with a driver error. */
export function diagnoseUrl(raw) {
  const value = raw.trim();
  if (value === "") return "Nothing pasted.";
  if (value.startsWith("eyJ") || value.startsWith("sb_") || value.startsWith("sbp_")) {
    return [
      "That looks like a Supabase API key, not a connection string.",
      "This project talks to plain Postgres and never uses Supabase's REST client, so the",
      "anon and service_role keys are not used at all.",
      "",
      "In Supabase: Project Settings -> Database -> Connection string -> URI.",
    ].join("\n");
  }
  if (value.startsWith("psql ")) {
    return "Drop the leading `psql ` and the quotes — paste only the postgres:// URL.";
  }
  if (!/^postgres(ql)?:\/\//.test(value)) {
    return "A Postgres connection string starts with postgres:// or postgresql://.";
  }
  return null;
}

async function verify(url) {
  process.stdout.write("  Connecting... ");
  const sql = postgres(url, { max: 1, connect_timeout: 15, onnotice: () => {} });
  try {
    const [row] = await sql`select current_database() as db, version() as version`;
    say(green("ok"));
    say(dim(`  ${row.db} — ${String(row.version).split(",")[0]}`));
    return true;
  } catch (error) {
    say(red("failed"));
    say(dim(`  ${error.message}`));
    return false;
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
}

async function startLocalDatabase() {
  say();
  say("  Starting Postgres in Docker...");
  const up = spawnSync("docker", ["compose", "up", "-d", "db"], {
    cwd: repoRoot,
    stdio: "inherit",
  });
  if (up.status !== 0) {
    say(red("  docker compose failed. Is Docker Desktop running?"));
    return null;
  }

  process.stdout.write("  Waiting for it to accept connections");
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const health = tryRun("docker", [
      "compose",
      "exec",
      "-T",
      "db",
      "pg_isready",
      "-U",
      "mimnets",
      "-d",
      "mimnets",
    ], { cwd: repoRoot });
    if (health?.includes("accepting connections")) {
      say(green(" ready"));
      return LOCAL_URL;
    }
    process.stdout.write(".");
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  say(red(" timed out"));
  return null;
}

async function askForUrl(provider) {
  const guidance = {
    neon: [
      "  Neon: create a project at neon.tech, then Dashboard -> Connection string.",
      "  Use the pooled connection (the host contains -pooler).",
    ],
    supabase: [
      "  Supabase: Project Settings -> Database -> Connection string -> URI.",
      "  Use the Session pooler URI, and put your database password into it.",
      dim("  Not the anon or service_role key — those belong to a client this project never uses."),
    ],
    other: ["  Any Postgres 14+ will do."],
  }[provider];

  say();
  guidance.forEach((line) => say(line));

  for (;;) {
    say();
    const answer = await rl.question("  Connection string: ");
    const problem = diagnoseUrl(answer);
    if (problem) {
      say();
      say(yellow(`  ${problem.split("\n").join("\n  ")}`));
      continue;
    }
    const url = normaliseUrl(answer);
    say();
    if (await verify(url)) return url;
    say();
    const retry = await rl.question("  Try a different connection string? [Y/n] ");
    if (retry.trim().toLowerCase() === "n") return null;
  }
}

async function main() {
  say();
  say(bold("  Mimnets — Site setup"));
  say(dim("  A Site owns its own database. This points it at one and applies the schema."));
  say();

  const existing = readExistingUrl();
  if (existing) {
    const redacted = existing.replace(/:\/\/([^:]+):[^@]+@/, "://$1:****@");
    say(`  Already configured: ${dim(redacted)}`);
    const keep = await rl.question("  Keep it? [Y/n] ");
    if (keep.trim().toLowerCase() !== "n") {
      if (await verify(existing)) return migrate();
      say();
      say(yellow("  That database is not reachable. Choose another below."));
    }
    say();
  }

  const docker = dockerState();
  const dockerLabel = docker.running
    ? green(`detected, running ${docker.version}`)
    : docker.installed
      ? yellow("installed, but not running")
      : dim("not installed");

  say(`  ${bold("1")}  Local Postgres in Docker   ${dockerLabel}`);
  say(`  ${bold("2")}  Neon                       ${dim("managed, free tier fits many Sites")}`);
  say(`  ${bold("3")}  Supabase                   ${dim("managed, connection string only")}`);
  say(`  ${bold("4")}  Another Postgres           ${dim("any host, any provider")}`);
  say();

  const defaultChoice = docker.running ? "1" : "2";
  const choice =
    (await rl.question(`  Which one? [${defaultChoice}] `)).trim() || defaultChoice;

  let url = null;
  if (choice === "1") {
    if (!docker.installed) {
      say();
      say(yellow("  Docker is not installed. Install Docker Desktop, or pick 2, 3 or 4."));
      return fail();
    }
    if (!docker.running) {
      say();
      say(yellow("  Docker is installed but not running. Start Docker Desktop, then press Enter."));
      await rl.question("  ");
      if (!dockerState().running) {
        say(red("  Still not running. Start it and run `pnpm setup` again."));
        return fail();
      }
    }
    url = await startLocalDatabase();
    if (url && !(await verify(url))) url = null;
  } else if (choice === "2" || choice === "3" || choice === "4") {
    url = await askForUrl({ 2: "neon", 3: "supabase", 4: "other" }[choice]);
  } else {
    say(red("  Not one of the options."));
    return fail();
  }

  if (!url) {
    say();
    say(red("  No database configured. Run `pnpm setup` again when you are ready."));
    return fail();
  }

  writeEnv(url);
  say();
  say(`  Wrote ${dim("starter/.env")}`);
  return migrate();
}

function migrate() {
  say();
  say("  Applying migrations...");
  // Spawn drizzle-kit's CJS entrypoint with this Node, not the .bin shim: Node refuses to
  // launch a Windows .cmd without a shell, and a shell would need the args escaped.
  const cli = join(starterDir, "node_modules", "drizzle-kit", "bin.cjs");
  const result = spawnSync(process.execPath, [cli, "migrate"], {
    cwd: starterDir,
    stdio: "inherit",
  });
  say();
  if (result.status !== 0) {
    say(red("  Migrations failed. The database is reachable but the schema was not applied."));
    return fail();
  }
  say(green("  Setup complete."));
  say();
  say(`  Next: ${bold("pnpm dev")} — the Site runs on http://localhost:3000`);
  say();
}

function fail() {
  process.exitCode = 1;
}

const isEntrypoint = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isEntrypoint) {
  main()
    .catch((error) => {
      say();
      say(red(`  ${error.message}`));
      fail();
    })
    .finally(() => rl.close());
}
