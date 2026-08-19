"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * The Editor's link to a Site's media library.
 *
 * The admin package cannot import a server action, and the registry cannot cross the
 * server/client boundary, so a Site injects these the same way it injects save and publish:
 * as functions on a prop. Everything below reads them from context rather than being handed
 * them through four layers of form rendering.
 */

export interface MediaItem {
  id: string;
  key: string;
  url: string;
  filename: string;
  contentType: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string;
  createdAt: string;
}

export interface MediaBridge {
  list: () => Promise<MediaItem[]>;
  upload: (form: FormData) => Promise<MediaItem>;
  /** Where keys are served from, so a chosen image previews in the panel. */
  baseUrl: string;
}

const MediaContext = createContext<MediaBridge | null>(null);

export function MediaProvider({ value, children }: { value: MediaBridge | null; children: ReactNode }) {
  return <MediaContext.Provider value={value}>{children}</MediaContext.Provider>;
}

/** Null when a Site has not wired media up — the field degrades to a plain key input. */
export function useMedia(): MediaBridge | null {
  return useContext(MediaContext);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * The library, as a modal over the Editor. Choosing is one click; uploading is the same
 * dialog, so an Author who has not uploaded yet is never sent somewhere else and back.
 */
export function MediaBrowser({
  onPick,
  onClose,
}: {
  onPick: (item: MediaItem) => void;
  onClose: () => void;
}) {
  const media = useMedia();
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!media) return;
    try {
      setItems(await media.list());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the media library.");
    }
  }, [media]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleFiles(files: FileList | null) {
    if (!media || !files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      let last: MediaItem | null = null;
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.set("file", file);
        last = await media.upload(form);
      }
      await refresh();
      // Uploading is almost always "and use this one", so save the second click.
      if (last) onPick(last);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mn-media-backdrop" role="dialog" aria-modal="true" aria-label="Media library">
      <div className="mn-media-modal">
        <header className="mn-media-head">
          <strong>Media</strong>
          <label className="mn-button">
            {busy ? "Uploading…" : "Upload"}
            <input
              type="file"
              accept="image/*"
              multiple
              hidden
              disabled={busy}
              onChange={(event) => void handleFiles(event.target.files)}
            />
          </label>
          <button type="button" className="mn-button" onClick={onClose}>
            Close
          </button>
        </header>

        {error ? <p className="mn-media-error">{error}</p> : null}

        {items === null ? (
          <p className="mn-media-empty">Loading…</p>
        ) : items.length === 0 ? (
          <p className="mn-media-empty">No images yet. Upload one to get started.</p>
        ) : (
          <ul className="mn-media-grid">
            {items.map((item) => (
              <li key={item.id}>
                <button type="button" className="mn-media-tile" onClick={() => onPick(item)}>
                  <img src={item.url} alt="" loading="lazy" />
                  <span className="mn-media-name" title={item.filename}>
                    {item.filename}
                  </span>
                  <span className="mn-media-meta">
                    {item.width && item.height ? `${item.width}×${item.height} · ` : ""}
                    {formatBytes(item.size)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
