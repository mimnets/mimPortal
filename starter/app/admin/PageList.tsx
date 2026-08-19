"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createPage, deletePage } from "./actions";

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
      {error ? <p className="mn-ed-error">{error}</p> : null}

      <ul className="mn-page-list">
        {pages.map((page) => (
          <li key={page.id} className="mn-page-row">
            <Link href={`/admin/pages/${page.id}`} className="mn-page-main">
              <strong>{page.title}</strong>
              <code>{page.path}</code>
            </Link>

            <span className={`mn-badge${page.isPublished ? " is-live" : ""}`}>
              {page.isPublished ? "Published" : "Draft only"}
            </span>

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
