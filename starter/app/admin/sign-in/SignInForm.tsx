"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "../../../lib/auth-client";

/**
 * There is no sign-up here on purpose. Accounts are created by an Owner or by the installer;
 * an open registration form on a client's Site is a liability rather than a feature.
 */
export function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const result = await authClient.signIn.email({ email, password });

    if (result.error) {
      // Deliberately vague: saying which half was wrong tells an attacker which emails exist.
      setError("Those details did not work.");
      setBusy(false);
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <main className="mn-auth">
      <form className="mn-auth-card" onSubmit={submit}>
        <h1>Sign in</h1>

        {error ? (
        <p className="mn-ed-error" role="alert" aria-atomic="true">
          {error}
        </p>
      ) : null}

        <label className="mn-field" htmlFor="email">
          <span>Email</span>
          <input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label className="mn-field" htmlFor="password">
          <span>Password</span>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        <button type="submit" className="mn-button mn-button-primary" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
