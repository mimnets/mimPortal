"use client";

import { useState } from "react";

export interface PageVersionSummary {
  id: string;
  publishedAt: string;
}

/**
 * Every publish leaves a snapshot. This is the "the client deleted the homepage" panel:
 * restoring loads an old layout back into the draft, where it can be looked at and then
 * published — or abandoned by reloading.
 */
export function History({
  versions,
  onRestore,
}: {
  versions: PageVersionSummary[];
  onRestore: (versionId: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (versions.length === 0) {
    return (
      <div className="mn-ed-panel-body">
        <p className="mn-ed-hint">
          Nothing published yet. Every publish records a snapshot here, and any of them can be
          restored into the draft.
        </p>
      </div>
    );
  }

  return (
    <div className="mn-ed-panel-body">
      <p className="mn-ed-hint">
        Restoring loads that version into the draft. The public Site does not change until you
        publish.
      </p>

      {/* role="alert" rather than a live region: this element only exists when something
          failed, so it is announced on insertion, and somebody who has just pressed a
          button and is waiting should be interrupted. */}
      {error ? (
        <p className="mn-ed-error" role="alert" aria-atomic="true">
          {error}
        </p>
      ) : null}

      <ol className="mn-versions">
        {versions.map((version, index) => (
          <li key={version.id} className="mn-version">
            <span>
              <strong>{index === 0 ? "Current" : `Version ${versions.length - index}`}</strong>
              <time dateTime={version.publishedAt}>
                {new Date(version.publishedAt).toLocaleString()}
              </time>
            </span>
            <button
              type="button"
              className="mn-button"
              disabled={busy !== null}
              onClick={async () => {
                setBusy(version.id);
                setError(null);
                try {
                  await onRestore(version.id);
                } catch (cause) {
                  setError(cause instanceof Error ? cause.message : "Could not restore");
                } finally {
                  setBusy(null);
                }
              }}
            >
              {busy === version.id ? "Restoring…" : "Restore"}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
