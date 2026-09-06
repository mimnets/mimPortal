"use client";

import { useState, useTransition } from "react";
import { formatBytes, type MediaItem } from "@mimnets/admin";
import type { MediaUse } from "../media-actions";

/**
 * Everything a Site has uploaded, in one place.
 *
 * Alt text is edited here rather than only in the Editor because describing a photograph is
 * a job someone can sit down and do for a whole library at once, which is not true when the
 * only way in is to place the image on a Page first.
 */
/**
 * Where one picture is used.
 *
 * Deliberately not a count on its own. "Used in 3 places" answers a different question from
 * the one an Author is actually asking, which is whether it is safe to delete this -- and
 * that depends on *which* three. A Shared Header is on every Page at once; an unpublished
 * draft is nowhere a visitor can see yet.
 */
function MediaUsage({ uses }: { uses: MediaUse[] }) {
  if (uses.length === 0) {
    return <div className="mn-media-usage is-unused">Not used on any Page</div>;
  }

  return (
    <div className="mn-media-usage">
      {uses.map((use, index) => (
        <span key={`${use.where}-${use.state}-${index}`} className="mn-media-use" data-state={use.state}>
          {use.href ? <a href={use.href}>{use.where}</a> : use.where}
          {use.state === "draft" ? <em> · draft only</em> : null}
          {use.state === "shared" ? <em> · every Page</em> : null}
        </span>
      ))}
    </div>
  );
}

export function MediaLibrary({
  items: initial,
  canDelete,
  storageName,
  onUpload,
  onSetAlt,
  usage,
  onDelete,
}: {
  items: MediaItem[];
  /** Where each stored key is used, by key. Absent from the map means nowhere. */
  usage: Record<string, MediaUse[]>;
  canDelete: boolean;
  storageName: string;
  onUpload: (form: FormData) => Promise<MediaItem>;
  onSetAlt: (id: string, alt: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [items, setItems] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const uploaded: MediaItem[] = [];
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.set("file", file);
        uploaded.push(await onUpload(form));
      }
      setItems((current) => [...uploaded, ...current]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(item: MediaItem) {
    // The warning used to be the same sentence whether the file was on six Pages or none of
    // them, so it taught an Author to click through it. Now it says which, and stays quiet
    // about consequences when there are none.
    const used = usage[item.key] ?? [];
    const message = used.length
      ? `Delete ${item.filename}?\n\nIt is used in ${used.length} place${
          used.length === 1 ? "" : "s"
        }:\n${used.map((one) => `  \u2022 ${one.where} (${one.state})`).join("\n")}\n\n` +
        "Those will show nothing afterwards."
      : `Delete ${item.filename}? Nothing is using it.`;

    if (!confirm(message)) return;
    setError(null);
    try {
      await onDelete(item.id);
      setItems((current) => current.filter((one) => one.id !== item.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That file could not be deleted.");
    }
  }

  return (
    <div className="mn-dash-body is-plain">
      <div className="mn-media-head">
        <strong>{items.length} file{items.length === 1 ? "" : "s"}</strong>
        <span className="mn-media-meta">stored on {storageName}</span>
        <label className="mn-button">
          {busy ? "Uploading…" : "Upload images"}
          <input
            type="file"
            accept="image/*"
            multiple
            hidden
            disabled={busy}
            onChange={(event) => void handleFiles(event.target.files)}
          />
        </label>
      </div>

      {/* role="alert" rather than a live region: this element only exists when something
          failed, so it is announced on insertion, and somebody who has just pressed a
          button and is waiting should be interrupted. */}
      {error ? (
        <p className="mn-media-error" role="alert" aria-atomic="true">
          {error}
        </p>
      ) : null}

      {items.length === 0 ? (
        <p className="mn-media-empty">
          Nothing uploaded yet. Images added here can be placed on any Page.
        </p>
      ) : (
        <ul className="mn-page-list">
          {items.map((item) => (
            <li key={item.id} className="mn-media-row">
              <img src={item.url} alt="" />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="mn-media-name" title={item.filename}>
                  {item.filename}
                </div>
                <div className="mn-media-meta">
                  {item.width && item.height ? `${item.width}×${item.height} · ` : ""}
                  {formatBytes(item.size)} · {item.contentType}
                </div>
                <MediaUsage uses={usage[item.key] ?? []} />
              </div>

              <label className="mn-field" style={{ flex: 1 }}>
                <span>Alt text</span>
                <input
                  defaultValue={item.alt}
                  placeholder="Describe what this shows"
                  // Saved when the Author leaves the field: an alt text is a sentence, and
                  // saving every keystroke would write forty rows for one of them.
                  onBlur={(event) => {
                    const alt = event.target.value;
                    if (alt === item.alt) return;
                    startTransition(async () => {
                      await onSetAlt(item.id, alt);
                      setItems((current) =>
                        current.map((one) => (one.id === item.id ? { ...one, alt } : one)),
                      );
                    });
                  }}
                />
              </label>

              {canDelete ? (
                <button
                  type="button"
                  className="mn-button mn-button-danger"
                  onClick={() => void handleDelete(item)}
                >
                  Delete
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
