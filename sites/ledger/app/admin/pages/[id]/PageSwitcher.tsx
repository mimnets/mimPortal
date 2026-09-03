"use client";

import { useRouter } from "next/navigation";

/**
 * Moves between Pages without going back to the list first.
 *
 * Editing a Site means going Page to Page — fixing the same wording on three of them, or
 * checking that a change looks right elsewhere. Sending someone back to the index between
 * every one of those is the kind of friction nobody reports as a bug and everybody feels.
 */
export function PageSwitcher({
  pages,
  currentId,
}: {
  pages: { id: string; title: string; path: string }[];
  currentId: string;
}) {
  const router = useRouter();

  if (pages.length < 2) return null;

  return (
    <label className="mn-page-switch">
      <span className="mn-visually-hidden">Switch Page</span>
      <select
        value={currentId}
        onChange={(event) => {
          const id = event.target.value;
          if (id !== currentId) router.push(`/admin/pages/${id}`);
        }}
      >
        {pages.map((page) => (
          <option key={page.id} value={page.id}>
            {page.title} — {page.path}
          </option>
        ))}
      </select>
    </label>
  );
}
