import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as authSchema from "./auth-schema";
import * as schema from "./schema";

export * from "./schema";
export * from "./auth-schema";

export type Database = ReturnType<typeof createDatabase>;

/**
 * Every Site owns its own database (ADR-0001), so the connection string is supplied by the
 * Site rather than resolved from a shared config here.
 */
export function createDatabase(connectionString: string) {
  const client = postgres(connectionString, { max: 1 });
  return drizzle(client, { schema: { ...schema, ...authSchema } });
}
