"use client";

import { useEffect } from "react";

/**
 * What a visitor sees when a Page throws while rendering.
 *
 * A layout that will not *parse* is already handled — the registry drops the Blocks it
 * cannot read and renders the rest. This is the other half: a Block that parses and then
 * throws inside its own `render`. Without a boundary that is Next's blank application-error
 * screen, which tells a visitor nothing and tells the Site's Owner nothing either.
 *
 * The Header and Footer survive, because this replaces the Page's content rather than the
 * document. Somebody who arrived on a broken Page can still navigate away from it.
 */
export default function PageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest is what ties this screen to a line in the server log; the message itself is
    // withheld from the browser in production, deliberately, and should stay that way.
    console.error("[mimnets] A Page failed to render.", error.digest ?? error.message);
  }, [error]);

  return (
    <main className="mn-section mn-section-default">
      <div className="mn-container mn-error-page">
        <h1>This page isn’t available right now</h1>
        <p>
          Something went wrong at our end, not yours. Nothing you did caused it and nothing
          has been lost.
        </p>
        <p className="mn-error-actions">
          <button type="button" className="mn-button mn-button-primary" onClick={reset}>
            Try again
          </button>
          <a className="mn-button" href="/">
            Go to the home page
          </a>
        </p>
        {error.digest ? <p className="mn-error-ref">Reference: {error.digest}</p> : null}
      </div>
    </main>
  );
}
