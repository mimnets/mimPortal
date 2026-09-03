"use client";

/**
 * The last resort: the root layout itself threw.
 *
 * This one replaces the whole document, so it renders its own <html> and <body> and cannot
 * rely on the Site's stylesheet, its Theme, or its fonts — none of them are loaded when the
 * layout that loads them is what failed. Everything here is inline for that reason, and the
 * colours are literal rather than Theme tokens because there is no Theme.
 *
 * Reaching this should mean a bad deploy or a missing environment variable, not a bad Page:
 * `app/error.tsx` catches those and keeps the Header and Footer.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "2rem",
          background: "#ffffff",
          color: "#141d26",
          font: "16px/1.6 system-ui, -apple-system, 'Segoe UI', sans-serif",
        }}
      >
        <main style={{ maxWidth: "34rem" }}>
          <h1 style={{ fontSize: "1.5rem", margin: "0 0 0.75rem" }}>This site is offline</h1>
          <p style={{ margin: "0 0 1.25rem", color: "#56646f" }}>
            It cannot start at the moment. This is a problem with the site itself, and the
            people who run it can see what happened in their server log.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              font: "inherit",
              padding: "0.5rem 1rem",
              border: "1px solid #141d26",
              background: "#141d26",
              color: "#ffffff",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {error.digest ? (
            <p style={{ marginTop: "1.5rem", fontSize: "0.8rem", color: "#7e8b96" }}>
              Reference: {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
