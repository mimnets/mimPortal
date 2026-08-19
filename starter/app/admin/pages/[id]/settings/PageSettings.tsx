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
  headerSlotId: initialHeader,
  footerSlotId: initialFooter,
  sharedSlots,
  otherPages,
  onSetSlots,
  onApplyToAll,
  onCopyStructure,
  aiEnabled,
  onGeneratePage,
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
  headerSlotId: string | null;
  footerSlotId: string | null;
  sharedSlots: { id: string; name: string; slot: string }[];
  otherPages: { id: string; title: string; path: string }[];
  onSetSlots: (input: {
    pageId: string;
    headerSlotId: string | null;
    footerSlotId: string | null;
  }) => Promise<void>;
  onApplyToAll: (pageId: string) => Promise<number>;
  onCopyStructure: (input: { pageId: string; fromPageId: string }) => Promise<unknown>;
  aiEnabled: boolean;
  onGeneratePage: (input: { pageId: string; brief: string }) => Promise<unknown>;
}) {
  const [seoTitle, setSeoTitle] = useState(initialSeoTitle);
  const [seoDescription, setSeoDescription] = useState(initialSeoDescription);
  const [seoImageKey, setSeoImageKey] = useState(initialSeoImageKey);
  const [name, setName] = useState(title);
  const [address, setAddress] = useState(path);
  const [headerSlotId, setHeaderSlotId] = useState(initialHeader);
  const [footerSlotId, setFooterSlotId] = useState(initialFooter);
  const [copyFrom, setCopyFrom] = useState("");
  const [pageBrief, setPageBrief] = useState("");
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

        <section className="mn-field-group">
          <legend>Header and Footer</legend>
          <p className="mn-media-meta">
            A shared Header appears on every Page that uses it, so editing it once changes them
            all. Choose “This Page only” to give this Page its own — the copy stored in its own
            layout, which is still there and comes back untouched.
          </p>

          {(["header", "footer"] as const).map((kind) => {
            const options = sharedSlots.filter((slot) => slot.slot === kind);
            const value = kind === "header" ? headerSlotId : footerSlotId;
            const set = kind === "header" ? setHeaderSlotId : setFooterSlotId;

            return (
              <label className="mn-field" key={kind}>
                <span>{kind === "header" ? "Header" : "Footer"}</span>
                <select
                  value={value ?? ""}
                  onChange={(event) => set(event.target.value || null)}
                  disabled={!canRename}
                >
                  <option value="">This Page only</option>
                  {options.map((slot) => (
                    <option key={slot.id} value={slot.id}>
                      {slot.name}
                    </option>
                  ))}
                </select>
                {options.length === 0 ? (
                  <small>
                    No shared {kind}s yet. Create one under Headers &amp; Footers.
                  </small>
                ) : null}
              </label>
            );
          })}

          {canRename ? (
            <div className="mn-image-actions">
              <button
                type="button"
                className="mn-button mn-button-primary"
                onClick={() =>
                  void run(
                    () => onSetSlots({ pageId, headerSlotId, footerSlotId }),
                    "Header and Footer saved.",
                  )
                }
              >
                Save
              </button>

              <button
                type="button"
                className="mn-button"
                onClick={() => {
                  if (!confirm("Give every Page this Header and Footer?")) return;
                  void run(async () => {
                    const count = await onApplyToAll(pageId);
                    setStatus(`Applied to ${count} Page${count === 1 ? "" : "s"}.`);
                  }, "");
                }}
                title="Every Page will use the same Header and Footer as this one"
              >
                Use on every Page
              </button>
            </div>
          ) : null}
        </section>

        {aiEnabled ? (
          <section className="mn-field-group">
            <legend>Rewrite this Page with AI</legend>
            <p className="mn-media-meta">
              Replaces this Page’s Blocks with a generated arrangement, written into the
              draft. What is published now is snapshotted first, so History has it — if the
              result is worse than what was there, restore the previous version and nothing
              was lost. The Header and Footer are left alone.
            </p>

            <label className="mn-field">
              <span>What should this Page say?</span>
              <textarea
                rows={3}
                value={pageBrief}
                placeholder="An about page for a family law firm in Leeds. Emphasise that we have been here since 1994."
                onChange={(event) => setPageBrief(event.target.value)}
              />
            </label>

            <div className="mn-image-actions">
              <button
                type="button"
                className="mn-button"
                disabled={pageBrief.trim().length < 3}
                onClick={() => {
                  if (!confirm("Replace this Page's draft with a generated one?")) return;
                  void run(
                    () => onGeneratePage({ pageId, brief: pageBrief }).then(() => undefined),
                    "Generated into the draft. Open the Editor to review and publish it.",
                  );
                }}
              >
                Generate this Page
              </button>
            </div>
          </section>
        ) : null}

        {canRename && otherPages.length > 0 ? (
          <section className="mn-field-group">
            <legend>Copy structure from another Page</legend>
            <p className="mn-media-meta">
              Copies the Main and Sidebar Blocks of another Page into this one’s draft. The
              Header and Footer are left alone — those are chosen above. Nothing is published
              until you publish it.
            </p>

            <label className="mn-field">
              <span>Copy from</span>
              <select value={copyFrom} onChange={(event) => setCopyFrom(event.target.value)}>
                <option value="">Choose a Page…</option>
                {otherPages.map((page) => (
                  <option key={page.id} value={page.id}>
                    {page.title} — {page.path}
                  </option>
                ))}
              </select>
            </label>

            <div className="mn-image-actions">
              <button
                type="button"
                className="mn-button"
                disabled={!copyFrom}
                onClick={() => {
                  if (!confirm("Replace this Page's Blocks with that Page's? The draft is overwritten.")) return;
                  void run(
                    () => onCopyStructure({ pageId, fromPageId: copyFrom }).then(() => undefined),
                    "Structure copied into the draft. Open the Editor to publish it.",
                  );
                }}
              >
                Copy into draft
              </button>
            </div>
          </section>
        ) : null}

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
