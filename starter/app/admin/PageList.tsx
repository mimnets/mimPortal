"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createPage, deletePage, renamePage } from "./actions";

interface PageSummary {
  id: string;
  path: string;
  title: string;
  isPublished: boolean;
  updatedAt: string;
}

export function PageList({ pages, canManage }: { pages: PageSummary[]; canManage: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Which row's name is being edited. Only one at a time. */
  const [renaming, setRenaming] = useState<string | null>(null);

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await work();
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mn-dash-body">
      {/* role="alert" rather than a live region: this element only exists when something
          failed, so it is announced on insertion, and somebody who has just pressed a
          button and is waiting should be interrupted. */}
      {error ? (
        <p className="mn-ed-error" role="alert" aria-atomic="true">
          {error}
        </p>
      ) : null}

      <ul className="mn-page-list">
        {pages.map((page) => (
          <li key={page.id} className="mn-page-row">
            {/* The name is the name. Clicking it renames the Page rather than navigating
                somewhere — Edit and Settings are their own buttons, so the row no longer
                has to overload its title with "open this". */}
            <span className="mn-page-main">
              {renaming === page.id ? (
                <input
                  className="mn-page-rename"
                  autoFocus
                  defaultValue={page.title}
                  onBlur={(event) => {
                    const title = event.target.value.trim();
                    setRenaming(null);
                    if (!title || title === page.title) return;
                    void run(() => renamePage({ pageId: page.id, title, path: page.path }));
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                    // Escape abandons the edit, which blurring would otherwise save.
                    if (event.key === "Escape") {
                      event.currentTarget.value = page.title;
                      event.currentTarget.blur();
                    }
                  }}
                />
              ) : canManage ? (
                <button
                  type="button"
                  className="mn-page-name"
                  title="Click to rename"
                  onClick={() => setRenaming(page.id)}
                >
                  {page.title}
                </button>
              ) : (
                <strong>{page.title}</strong>
              )}
              <code>{page.path}</code>
            </span>

            <span className={`mn-badge${page.isPublished ? " is-live" : ""}`}>
              {page.isPublished ? "Published" : "Draft only"}
            </span>

            <Link className="mn-button" href={`/admin/pages/${page.id}`}>
              Edit
            </Link>

            <Link className="mn-button" href={`/admin/pages/${page.id}/settings`}>
              Settings
            </Link>

            <a className="mn-button" href={page.path} target="_blank" rel="noreferrer">
              View
            </a>

            {canManage ? (
              <button
                type="button"
                className="mn-button mn-button-danger"
                disabled={busy}
                onClick={() => {
                  // Deleting a Page takes its version history with it, so it asks first.
                  if (!window.confirm(`Delete "${page.title}" and its history?`)) return;
                  void run(() => deletePage(page.id));
                }}
              >
                Delete
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      {canManage ? (
        <form
          className="mn-new-page"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const form = event.currentTarget;
            void run(async () => {
              const id = await createPage({
                title: String(data.get("title") ?? ""),
                path: String(data.get("path") ?? ""),
              });
              form.reset();
              router.push(`/admin/pages/${id}`);
            });
          }}
        >
          <strong>New Page</strong>
          <label className="mn-field" htmlFor="title">
            <span>Title</span>
            <input id="title" name="title" required placeholder="About" />
          </label>
          <label className="mn-field" htmlFor="path">
            <span>Path</span>
            <input id="path" name="path" required placeholder="/about" />
          </label>
          <button type="submit" className="mn-button mn-button-primary" disabled={busy}>
            Create
          </button>
        </form>
      ) : null}
    </div>
  );
}
