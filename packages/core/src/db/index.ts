import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as authSchema from "./auth-schema";
import * as schema from "./schema";

export * from "./schema";
export * from "./auth-schema";

export type Database = ReturnType<typeof createDatabase>;

/**
 * Connections are pooled per connection string, and the pool is kept on `globalThis`.
 *
 * This is not a micro-optimisation. `createDatabase` is called from every page render,
 * every route handler and every server action — the public Page calls it twice, once for
 * its metadata and once for its body — and each call used to open a pool that nothing ever
 * closed. A Site under modest traffic ran Postgres out of connections and started refusing
 * requests; a long development session did the same thing.
 *
 * `globalThis` rather than a module-level variable because a development server re-evaluates
 * modules on every edit, which would hand each reload a fresh pool and leak exactly as
 * before.
 */
const POOLS = Symbol.for("mimnets.database.pools");

interface PoolRegistry {
  [POOLS]?: Map<string, ReturnType<typeof drizzle>>;
}

function registry(): Map<string, ReturnType<typeof drizzle>> {
  const host = globalThis as PoolRegistry;
  host[POOLS] ??= new Map();
  return host[POOLS];
}

/**
 * Every Site owns its own database (ADR-0001), so the connection string is supplied by the
 * Site rather than resolved from a shared config here.
 */
export function createDatabase(connectionString: string) {
  const pools = registry();

  const existing = pools.get(connectionString);
  if (existing) return existing as ReturnType<typeof drizzle<typeof schema & typeof authSchema>>;

  // `max` is per Site rather than per request now that the pool is shared. Ten is generous
  // for a brochure Site and leaves room for several Sites against one Postgres.
  const client = postgres(connectionString, { max: Number(process.env.DATABASE_POOL_MAX ?? 10) });
  const db = drizzle(client, { schema: { ...schema, ...authSchema } });

  pools.set(connectionString, db);
  return db;
}
