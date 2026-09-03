import { afterEach, describe, expect, it, vi } from "vitest";

import { installMode, signUpOpen } from "./install";

/**
 * The installer's state machine, asked about the cases that used to fail open.
 *
 * No database is needed and none must be reachable: the whole point is what this reports
 * when it cannot reach one. The unreachable address is a closed port on the loopback
 * interface, so the connection is refused rather than left to time out.
 */
const UNREACHABLE = "postgres://nobody:nothing@127.0.0.1:1/none";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("what the installer reports", () => {
  it("asks for a database when none is configured", async () => {
    vi.stubEnv("DATABASE_URL", "");

    expect(await installMode()).toBe("provisioning");
  });

  it("reports an unreachable database as unavailable, never as provisioning", async () => {
    vi.stubEnv("DATABASE_URL", UNREACHABLE);

    // Reporting this as "provisioning" is what re-opened an unauthenticated action that
    // accepts a connection string and rewrites .env.
    expect(await installMode()).toBe("unavailable");
  });

  it("closes sign-up while the database is unreachable", async () => {
    vi.stubEnv("DATABASE_URL", UNREACHABLE);

    expect(await signUpOpen()).toBe(false);
  });

  it("closes sign-up when no database is configured", async () => {
    vi.stubEnv("DATABASE_URL", "");

    expect(await signUpOpen()).toBe(false);
  });
});
