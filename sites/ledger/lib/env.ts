/** Reads the environment once, and fails loudly rather than falling back to a default. */
export function databaseUrl(): string | null {
  return process.env.DATABASE_URL || null;
}

export function requireDatabaseUrl(): string {
  const url = databaseUrl();
  if (!url) throw new Error("DATABASE_URL is not set. Run `pnpm setup` or visit /install.");
  return url;
}

export function authSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "AUTH_SECRET is not set. Generate one with `openssl rand -base64 32` and put it in .env.",
    );
  }
  return secret;
}

export function baseUrl(): string {
  return process.env.BASE_URL ?? "http://localhost:3000";
}
