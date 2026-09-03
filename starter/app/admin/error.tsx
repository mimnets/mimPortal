"use client";

import { useEffect } from "react";

/**
 * What an Author sees when a Dashboard screen throws.
 *
 * Separate from the public one because the audience is different: this reader has an
 * account, can act on the problem, and — most importantly — needs to be told what happened
 * to their work. A Dashboard that fails silently teaches people to distrust Save.
 *
 * The Editor's own Blocks are caught closer in, by BlockBoundary, so a Block that throws
 * mid-keystroke never reaches here and never costs an unsaved draft. This catches everything
 * else: a screen that failed to load, an action that threw on the way back.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[mimnets] A Dashboard screen failed.", error);
  }, [error]);

  return (
    <main className="mn-dash-body">
      <div className="mn-error-page">
        <h1>Something went wrong on this screen</h1>
        <p>
          The Site itself is unaffected — visitors are seeing the published version as
          normal, and nothing has been deleted.
        </p>
        <p>
          <strong>If you were editing a Page, any unsaved changes on this screen are gone.</strong>{" "}
          What you last saved is safe, and publishing has not happened by accident.
        </p>
        <p className="mn-error-actions">
          <button type="button" className="mn-button mn-button-primary" onClick={reset}>
            Try again
          </button>
          <a className="mn-button" href="/admin">
            Back to the Dashboard
          </a>
        </p>
        {error.digest ? <p className="mn-error-ref">Reference: {error.digest}</p> : null}
      </div>
    </main>
  );
}
