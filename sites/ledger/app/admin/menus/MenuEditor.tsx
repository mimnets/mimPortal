"use client";

import { useState } from "react";
import type { MenuItem } from "@mimnets/core";

/**
 * A Menu is edited in one place and rendered wherever it is used — the Header and the
 * Footer show the same links, so a client who changes one sees both change.
 */
export interface MenuPage {
  id: string;
  path: string;
  title: string;
  published: boolean;
}

export function MenuEditor({
  slug,
  items: initial,
  pages,
  canEdit,
  onSave,
}: {
  slug: string;
  items: MenuItem[];
  pages: MenuPage[];
  canEdit: boolean;
  onSave: (items: MenuItem[]) => Promise<void>;
}) {
  const [items, setItems] = useState<MenuItem[]>(initial);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function update(next: MenuItem[]) {
    setItems(next);
    setDirty(true);
    setMessage(null);
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    if (moved) next.splice(to, 0, moved);
    update(next);
  }

  function add(item: Omit<MenuItem, "id">) {
    update([...items, { id: crypto.randomUUID().slice(0, 8), ...item }]);
  }

  /**
   * A Page already in the Menu is not offered again.
   *
   * Matched on the path rather than on the Page's id, because that is what a Menu item
   * actually stores — an item typed by hand before this existed points at the same Page as
   * one added from this list, and offering it twice would be a lie.
   */
  const linked = new Set(items.map((item) => item.href));
  const unlinked = pages.filter((page) => !linked.has(page.path));

  return (
    <div className="mn-dash-body">
      <p className="mn-ed-hint">
        These links appear everywhere the “{slug}” Menu is used. Changing them here updates
        the Header and the Footer together.
      </p>

      {error ? <p className="mn-ed-error">{error}</p> : null}
      {message ? <p className="mn-ed-hint">{message}</p> : null}

      <ul className="mn-menu-items">
        {items.map((item, index) => (
          <li key={item.id} className="mn-menu-item">
            <label className="mn-field" htmlFor={`label-${item.id}`}>
              <span>Label</span>
              <input
                id={`label-${item.id}`}
                value={item.label}
                disabled={!canEdit}
                onChange={(event) =>
                  update(items.map((i) => (i.id === item.id ? { ...i, label: event.target.value } : i)))
                }
              />
            </label>

            <label className="mn-field" htmlFor={`href-${item.id}`}>
              <span>Links to</span>
              <input
                id={`href-${item.id}`}
                value={item.href}
                placeholder="/about"
                disabled={!canEdit}
                onChange={(event) =>
                  update(items.map((i) => (i.id === item.id ? { ...i, href: event.target.value } : i)))
                }
              />
            </label>

            {canEdit ? (
              <div className="mn-menu-actions">
                <button type="button" className="mn-button" onClick={() => move(index, index - 1)}>
                  ↑
                </button>
                <button type="button" className="mn-button" onClick={() => move(index, index + 1)}>
                  ↓
                </button>
                <button
                  type="button"
                  className="mn-button mn-button-danger"
                  onClick={() => update(items.filter((i) => i.id !== item.id))}
                >
                  Remove
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {canEdit && pages.length > 0 ? (
        <section className="mn-menu-add-pages">
          <h2>Add a Page</h2>

          {unlinked.length === 0 ? (
            <p className="mn-ed-hint">
              Every Page on this Site is already in this Menu. New Pages will appear here.
            </p>
          ) : (
            <>
              <p className="mn-ed-hint">
                Pick a Page rather than typing its address — a link added this way cannot point
                at a path that does not exist.
              </p>
              <ul className="mn-menu-pages">
                {unlinked.map((page) => (
                  <li key={page.id}>
                    <button
                      type="button"
                      className="mn-menu-page"
                      onClick={() => add({ label: page.title, href: page.path, newTab: false })}
                    >
                      <span className="mn-menu-page-main">
                        <span className="mn-menu-page-title">{page.title}</span>
                        <code>{page.path}</code>
                      </span>
                      {page.published ? (
                        <span className="mn-badge is-live">Live</span>
                      ) : (
                        /* Offered anyway: an Owner building a Menu ahead of a launch is a
                           normal thing to be doing. Marked, so nobody links to a Page a
                           visitor would get a 404 from without knowing they did. */
                        <span className="mn-badge">Draft</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      ) : null}

      {canEdit ? (
        <div className="mn-menu-bar">
          <button
            type="button"
            className="mn-button"
            onClick={() => add({ label: "New link", href: "/", newTab: false })}
          >
            + Add link
          </button>

          <button
            type="button"
            className="mn-button mn-button-primary"
            disabled={busy || !dirty}
            onClick={() => {
              setBusy(true);
              setError(null);
              onSave(items)
                .then(() => {
                  setDirty(false);
                  setMessage("Menu saved — it is live everywhere it appears.");
                })
                .catch((cause: unknown) =>
                  setError(cause instanceof Error ? cause.message : "Could not save"),
                )
                .finally(() => setBusy(false));
            }}
          >
            {busy ? "Saving…" : "Save Menu"}
          </button>
        </div>
      ) : (
        <p className="mn-ed-hint">Only an Owner can change Menus.</p>
      )}
    </div>
  );
}
