"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { SharedSlotSummary } from "../slot-actions";

/**
 * Every shared Header and Footer, with how many Pages use each.
 *
 * The count is the important column. Editing one of these changes every Page in that number
 * at once, and an Owner about to do that should be told the size of it first.
 */
export function SlotList({
  slots,
  onCreate,
  onRename,
  onDelete,
  onStickyChange,
}: {
  slots: SharedSlotSummary[];
  onCreate: (input: { name: string; slot: string; copyFromId?: string }) => Promise<string>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onStickyChange: (id: string, sticky: string) => Promise<void>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const headers = slots.filter((slot) => slot.slot === "header");
  const footers = slots.filter((slot) => slot.slot === "footer");

  function create(slot: "header" | "footer", copyFromId?: string) {
    const suggested = slot === "header" ? "New header" : "New footer";
    const name = prompt(`Name this ${slot}`, suggested);
    if (name === null) return;

    setError(null);
    startTransition(async () => {
      try {
        const id = await onCreate({ name, slot, copyFromId });
        router.push(`/admin/slots/${id}`);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "That could not be created.");
      }
    });
  }

  function setSticky(slot: SharedSlotSummary, sticky: string) {
    setError(null);
    startTransition(async () => {
      try {
        await onStickyChange(slot.id, sticky);
        // Every Page using this Header renders differently now, and the count beside it is
        // how many. Refreshing is what shows the change without a reload.
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "That could not be changed.");
      }
    });
  }

  function remove(slot: SharedSlotSummary) {
    const warning =
      slot.usedBy > 0
        ? `Delete "${slot.name}"? ${slot.usedBy} Page${slot.usedBy === 1 ? "" : "s"} will fall back to their own ${slot.slot}.`
        : `Delete "${slot.name}"?`;
    if (!confirm(warning)) return;

    setError(null);
    startTransition(async () => {
      try {
        await onDelete(slot.id);
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "That could not be deleted.");
      }
    });
  }

  function rename(slot: SharedSlotSummary) {
    const name = prompt("Rename", slot.name);
    if (name === null || name === slot.name) return;

    startTransition(async () => {
      await onRename(slot.id, name);
      router.refresh();
    });
  }

  const group = (kind: "header" | "footer", items: SharedSlotSummary[]) => (
    <section className="mn-field-group">
      <legend>{kind === "header" ? "Headers" : "Footers"}</legend>

      {items.length === 0 ? (
        <p className="mn-media-empty">
          None yet. Every Page is using its own {kind}, which means editing one changes only
          that Page.
        </p>
      ) : (
        <ul className="mn-page-list">
          {items.map((slot) => (
            <li key={slot.id} className="mn-page-row">
              <Link href={`/admin/slots/${slot.id}`} className="mn-page-main">
                <strong>{slot.name}</strong>
                <code>{slot.slug}</code>
              </Link>

              <span className={`mn-badge${slot.usedBy > 0 ? " is-live" : ""}`}>
                {slot.usedBy === 0
                  ? "Unused"
                  : `${slot.usedBy} Page${slot.usedBy === 1 ? "" : "s"}`}
              </span>

              {/* Headers only. A Footer is already at the bottom of the document, so making
                  one stay pins it over the end of every Page -- see ADR-0020. The renderer
                  refuses it as well; this is only the half that stops it being asked for. */}
              {kind === "header" ? (
                <label className="mn-field mn-field-inline" htmlFor={`sticky-${slot.id}`}>
                  <span className="mn-visually-hidden">Scrolling behaviour for {slot.name}</span>
                  <select
                    id={`sticky-${slot.id}`}
                    value={slot.sticky}
                    disabled={busy}
                    onChange={(event) => setSticky(slot, event.target.value)}
                  >
                    <option value="scrolls">Scrolls away</option>
                    <option value="sticky">Stays on screen</option>
                  </select>
                </label>
              ) : null}

              <button type="button" className="mn-button" disabled={busy} onClick={() => rename(slot)}>
                Rename
              </button>
              <button
                type="button"
                className="mn-button"
                disabled={busy}
                onClick={() => create(kind, slot.id)}
                title="Create a copy to change without affecting the original"
              >
                Duplicate
              </button>
              <button
                type="button"
                className="mn-button mn-button-danger"
                disabled={busy}
                onClick={() => remove(slot)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mn-image-actions">
        <button type="button" className="mn-button" disabled={busy} onClick={() => create(kind)}>
          New {kind}
        </button>
      </div>
    </section>
  );

  return (
    <>
      {error ? (
        <p className="mn-media-error" role="alert" aria-atomic="true">
          {error}
        </p>
      ) : null}

      <p className="mn-media-meta">
        A Page picks its Header and Footer in its own settings. Change one here and every Page
        using it changes at once — which is what a Header is for, and why these are edited in
        one place rather than on each Page.
      </p>

      {group("header", headers)}
      {group("footer", footers)}
    </>
  );
}
