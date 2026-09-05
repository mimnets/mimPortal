"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

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

  /**
   * Makes `aria-modal` true rather than merely claimed.
   *
   * The attribute tells a screen reader that everything outside this dialog is not there.
   * Tab did not agree: focus was never moved in and never held, so it walked straight out
   * into an Editor the reader had just been told did not exist — which is worse than not
   * having marked it modal at all.
   *
   * Three things, and all three are the contract: focus moves in on open, Tab and Shift+Tab
   * cycle within, and whatever was focused before gets it back on close — so an Author who
   * opens the picker from an image field and closes it is back at that field, not at the top
   * of the page.
   */
  const dialog = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const returnTo = document.activeElement as HTMLElement | null;

    const focusable = () =>
      Array.from(
        dialog.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => element.offsetParent !== null || element === document.activeElement);

    focusable()[0]?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const stops = focusable();
      if (stops.length === 0) return;

      const first = stops[0]!;
      const last = stops[stops.length - 1]!;
      const active = document.activeElement;

      // Wrapping by hand, because the browser will happily tab out of a div.
      if (event.shiftKey && (active === first || !dialog.current?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      returnTo?.focus?.();
    };
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
    <div
      ref={dialog}
      className="mn-media-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Media library"
    >
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

        {error ? (
        <p className="mn-media-error" role="alert" aria-atomic="true">
          {error}
        </p>
      ) : null}

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
