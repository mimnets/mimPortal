"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { completeInstall, provisionDatabase } from "./actions";

export function InstallForm({ mode }: { mode: "provisioning" | "onboarding" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <main className="mn-auth">
        <div className="mn-auth-card">
          <h1>Database ready</h1>
          <p className="mn-ed-hint">
            The schema is applied and the configuration is written. Restart the server, then
            reload this page to create the first Owner — the connection string is read at boot.
          </p>
        </div>
      </main>
    );
  }

  if (mode === "provisioning") {
    return (
      <main className="mn-auth">
        <form
          className="mn-auth-card"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void run(async () => {
              await provisionDatabase(String(data.get("connectionString") ?? ""));
              setDone(true);
            });
          }}
        >
          <h1>Connect a database</h1>
          <p className="mn-ed-hint">
            Paste a Postgres connection string — Neon, Supabase, or your own server. It is
            checked and the schema applied before anything is written.
          </p>

          {error ? (
        <p className="mn-ed-error" role="alert" aria-atomic="true">
          {error}
        </p>
      ) : null}

          <label className="mn-field" htmlFor="connectionString">
            <span>Connection string</span>
            <input id="connectionString" name="connectionString" required placeholder="postgres://…" />
            <small>Supabase: Project Settings → Database → Connection string → URI. Not an API key.</small>
          </label>

          <button type="submit" className="mn-button mn-button-primary" disabled={busy}>
            {busy ? "Checking…" : "Connect and apply schema"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="mn-auth">
      <form
        className="mn-auth-card"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          void run(async () => {
            await completeInstall({
              token: String(data.get("token") ?? ""),
              siteName: String(data.get("siteName") ?? ""),
              name: String(data.get("name") ?? ""),
              email: String(data.get("email") ?? ""),
              password: String(data.get("password") ?? ""),
            });
            router.push("/admin/sign-in");
            router.refresh();
          });
        }}
      >
        <h1>Set up this Site</h1>
        <p className="mn-ed-hint">
          The install token is printed in the server log. This form cannot see or change the
          database.
        </p>

        {error ? (
        <p className="mn-ed-error" role="alert" aria-atomic="true">
          {error}
        </p>
      ) : null}

        <label className="mn-field" htmlFor="token">
          <span>Install token</span>
          <input id="token" name="token" required autoComplete="off" />
        </label>

        <label className="mn-field" htmlFor="siteName">
          <span>Site name</span>
          <input id="siteName" name="siteName" required defaultValue="My Site" />
        </label>

        <label className="mn-field" htmlFor="name">
          <span>Your name</span>
          <input id="name" name="name" required autoComplete="name" />
        </label>

        <label className="mn-field" htmlFor="email">
          <span>Email</span>
          <input id="email" name="email" type="email" required autoComplete="username" />
        </label>

        <label className="mn-field" htmlFor="password">
          <span>Password</span>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={12}
            autoComplete="new-password"
          />
          <small>At least 12 characters.</small>
        </label>

        <button type="submit" className="mn-button mn-button-primary" disabled={busy}>
          {busy ? "Setting up…" : "Create Owner and finish"}
        </button>
      </form>
    </main>
  );
}
