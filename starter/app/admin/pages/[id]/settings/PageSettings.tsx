"use client";

import { useState } from "react";
import { MediaBrowser, MediaProvider, type MediaItem } from "@mimnets/admin";

/**
 * A Page's name, its address, and what the rest of the web sees when it is linked.
 *
 * The SEO fields are deliberately not required. A Site with an empty description outranks a
 * Site with the same description on forty Pages, which is what a required field produces.
 */
export function PageSettings({
  pageId,
  title,
  path,
  seoTitle: initialSeoTitle,
  seoDescription: initialSeoDescription,
  seoImageKey: initialSeoImageKey,
  canRename,
  mediaBaseUrl,
  onSaveSeo,
  onRename,
  onListMedia,
  onUploadMedia,
}: {
  pageId: string;
  title: string;
  path: string;
  seoTitle: string;
  seoDescription: string;
  seoImageKey: string;
  canRename: boolean;
  mediaBaseUrl: string;
  onSaveSeo: (input: {
    pageId: string;
    seoTitle: string;
    seoDescription: string;
    seoImageKey: string;
  }) => Promise<void>;
  onRename: (input: { pageId: string; title: string; path: string }) => Promise<void>;
  onListMedia: () => Promise<MediaItem[]>;
  onUploadMedia: (form: FormData) => Promise<MediaItem>;
}) {
  const [seoTitle, setSeoTitle] = useState(initialSeoTitle);
  const [seoDescription, setSeoDescription] = useState(initialSeoDescription);
  const [seoImageKey, setSeoImageKey] = useState(initialSeoImageKey);
  const [name, setName] = useState(title);
  const [address, setAddress] = useState(path);
  const [browsing, setBrowsing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(work: () => Promise<void>, done: string) {
    setError(null);
    setStatus(null);
    try {
      await work();
      setStatus(done);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That could not be saved.");
    }
  }

  return (
    <MediaProvider value={{ list: onListMedia, upload: onUploadMedia, baseUrl: mediaBaseUrl }}>
      <div className="mn-dash-body">
        {error ? <p className="mn-media-error">{error}</p> : null}
        {status ? <p className="mn-media-meta">{status}</p> : null}

        <section className="mn-field-group">
          <legend>Search and sharing</legend>

          <label className="mn-field">
            <span>Title</span>
            <input
              value={seoTitle}
              placeholder={title}
              onChange={(event) => setSeoTitle(event.target.value)}
            />
            <small>Shown in a search result and the browser tab. Empty uses “{title}”.</small>
          </label>

          <label className="mn-field">
            <span>Description</span>
            <textarea
              rows={3}
              value={seoDescription}
              onChange={(event) => setSeoDescription(event.target.value)}
            />
            <small>
              The sentence under the link in a search result. Around 155 characters —{" "}
              {seoDescription.length} so far.
            </small>
          </label>

          <div className="mn-field">
            <span>Share image</span>
            {seoImageKey ? (
              <div className="mn-image-chosen">
                <img src={`${mediaBaseUrl}/${seoImageKey}`} alt="" />
              </div>
            ) : (
              <p className="mn-media-empty">
                No share image. Links to this Page will preview without one.
              </p>
            )}
            <div className="mn-image-actions">
              <button type="button" className="mn-button" onClick={() => setBrowsing(true)}>
                {seoImageKey ? "Replace" : "Choose image"}
              </button>
              {seoImageKey ? (
                <button type="button" className="mn-button" onClick={() => setSeoImageKey("")}>
                  Remove
                </button>
              ) : null}
            </div>
          </div>

          <div className="mn-image-actions">
            <button
              type="button"
              className="mn-button mn-button-primary"
              onClick={() =>
                void run(
                  () => onSaveSeo({ pageId, seoTitle, seoDescription, seoImageKey }),
                  "Search and sharing saved.",
                )
              }
            >
              Save
            </button>
          </div>
        </section>

        {canRename ? (
          <section className="mn-field-group">
            <legend>Name and address</legend>

            <label className="mn-field">
              <span>Title</span>
              <input value={name} onChange={(event) => setName(event.target.value)} />
            </label>

            <label className="mn-field">
              <span>Path</span>
              <input value={address} onChange={(event) => setAddress(event.target.value)} />
              <small>
                Changing this changes the Page’s address. Links pointing at the old one will
                stop working — Menus are edited separately.
              </small>
            </label>

            <div className="mn-image-actions">
              <button
                type="button"
                className="mn-button"
                onClick={() =>
                  void run(
                    () => onRename({ pageId, title: name, path: address }),
                    "Name and address saved.",
                  )
                }
              >
                Save
              </button>
            </div>
          </section>
        ) : null}

        {browsing ? (
          <MediaBrowser
            onClose={() => setBrowsing(false)}
            onPick={(item) => {
              setSeoImageKey(item.key);
              setBrowsing(false);
            }}
          />
        ) : null}
      </div>
    </MediaProvider>
  );
}
