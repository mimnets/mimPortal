/**
 * The guard that runs before a package is published.
 *
 * It used to be an inline `node -e` repeated in all three package.json files, and it checked
 * exactly one thing: that the package manager was pnpm. That check is real and the reasoning
 * behind it is kept below — but it meant the guard asserted who was publishing and never
 * *what*. `files: ["dist"]` plus a `publishConfig.exports` map pointing into `dist` is a
 * package whose entire contents are generated, and nothing confirmed they had been generated.
 * A publish with an absent or stale `dist` passed the guard and shipped.
 *
 * Run from a package directory:
 *
 *     node ../../scripts/check-publish.mjs
 */

import { readFileSync, statSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const cwd = process.cwd();
const pkg = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8"));

function fail(lines) {
  console.error(`\n  ${lines.join("\n  ")}\n`);
  process.exit(1);
}

/* ---- 1. pnpm, not npm --------------------------------------------------- */

// npm ignores publishConfig.exports, so it would ship a package whose exports point at ./src
// while `files` ships only ./dist. It installs and then fails on the first import, which is a
// worse failure than refusing to publish.
const agent = process.env.npm_config_user_agent ?? "";
if (!/pnpm/.test(agent)) {
  fail([
    `Publish ${pkg.name} with pnpm, not npm.`,
    "",
    "npm ignores publishConfig.exports, so it would ship a package whose exports",
    "point at ./src while files ships only ./dist. It installs and then fails on",
    "the first import, which is a worse failure than refusing to publish.",
  ]);
}

/* ---- 2. Everything the published exports promise must exist -------------- */

/** Every file path named anywhere in the publishConfig export map. */
function targets(node, found = []) {
  if (typeof node === "string") {
    if (node.startsWith("./")) found.push(node);
  } else if (node && typeof node === "object") {
    for (const value of Object.values(node)) targets(value, found);
  }
  return found;
}

const promised = [...new Set(targets(pkg.publishConfig?.exports ?? {}))];
const missing = promised.filter((relative) => {
  try {
    return !statSync(resolve(cwd, relative)).isFile();
  } catch {
    return true;
  }
});

if (missing.length > 0) {
  fail([
    `${pkg.name} would publish a package whose exports point at files that do not exist.`,
    "",
    ...missing.map((path) => `  missing: ${path}`),
    "",
    "Run `pnpm build:packages` from the repository root and publish again.",
  ]);
}

/* ---- 3. Staleness is deliberately NOT checked here ---------------------

 * The obvious next check is that `dist` is newer than `src`, and it was written and then
 * removed. Modification times do not mean what it needs them to mean: `git checkout` rewrites
 * every file it touches with the current time, so switching branches makes untouched sources
 * look newer than a perfectly current build. The guard failed on `@mimnets/admin` for exactly
 * that reason, having been given a file nobody had edited.
 *
 * A guard that refuses a legitimate publish is worse than no guard, because the first thing
 * anyone does with it is learn to skip it. Content hashing is the right tool and turbo already
 * does it — `pnpm build:packages` is a no-op when the build is current, so running it before
 * publishing costs nothing and is what `pnpm release` already does.
 */

console.log(`  ${pkg.name}: ${promised.length} published entry points present.`);
