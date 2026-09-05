"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Changing a Theme by hand.
 *
 * The half that makes a ready-made design usable rather than take-it-or-leave-it: apply one,
 * then move the two colours that carry the brand. Regenerating to change a colour would be
 * absurd, and editing `theme.ts` is not something a client can do.
 *
 * Only the colours and the two font stacks are offered. Spacing, radius and measure are
 * genuine design decisions that a colour picker does not help anybody make — those stay in
 * `theme.ts`, where somebody who wants them has a file and a comment explaining each.
 */

const COLOURS = [
  ["primary", "Primary", "Buttons, links, and the main coloured band."],
  ["accent", "Accent", "The second colour — eyebrows, statistics, the strongest call to action."],
  ["background", "Page", "The colour behind everything."],
  ["surface", "Tinted band", "A step off the page, for alternating Sections."],
  ["text", "Text", "Body copy and headings."],
  ["muted", "Muted text", "Captions and secondary lines."],
  ["border", "Lines", "Card edges and rules."],
] as const;

const FONT_STACKS = [
  ['"Segoe UI", system-ui, -apple-system, sans-serif', "System sans"],
  ['Georgia, "Iowan Old Style", "Times New Roman", serif', "Georgia serif"],
  ['"Palatino Linotype", Palatino, Georgia, serif', "Palatino serif"],
  ['"Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif', "Display sans"],
  ["ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", "Monospace"],
] as const;

export interface EditableTheme {
  colors: Record<string, string>;
  fonts: { body: string; heading: string };
  /**
   * Carried, not edited.
   *
   * `save` posts the whole draft and the action replaces the stored Theme with it, so
   * anything missing here is silently dropped — a Site that had stated a corner scale or a
   * surface style in `theme.ts` would lose it the first time somebody moved a colour.
   */
  radius: Record<string, string>;
  border: Record<string, string>;
  surface: string;
  spacing: { section: string; gutter: string };
  measure: string;
}

export function ThemeEditor({
  theme,
  onSave,
}: {
  theme: EditableTheme;
  onSave: (theme: Record<string, unknown>) => Promise<void>;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(theme);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty = JSON.stringify(draft) !== JSON.stringify(theme);

  function setColour(name: string, value: string) {
    setDraft((current) => ({ ...current, colors: { ...current.colors, [name]: value } }));
  }

  async function save() {
    setBusy(true);
    setError(null);
    setStatus(null);

    try {
      // onPrimary and onAccent are deliberately not sent: they are derived from the colours
      // above, so a person changing the primary never has to think about contrast.
      const { onPrimary: _p, onAccent: _a, ...colors } = draft.colors;
      await onSave({ ...draft, colors });
      setStatus("Saved. Every Page uses it now.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mn-field-group">
      <legend>Customise the colours and type</legend>

      {error ? (
        <p className="mn-media-error" role="alert" aria-atomic="true">
          {error}
        </p>
      ) : null}
      {status ? <p className="mn-preset-status">{status}</p> : null}

      <div className="mn-colour-grid">
        {COLOURS.map(([name, label, help]) => (
          <label className="mn-colour" key={name}>
            <input
              type="color"
              value={draft.colors[name] ?? "#000000"}
              onChange={(event) => setColour(name, event.target.value)}
            />
            <span>
              <strong>{label}</strong>
              <small>{help}</small>
              <code>{draft.colors[name]}</code>
            </span>
          </label>
        ))}
      </div>

      {(
        [
          ["heading", "Headings"],
          ["body", "Body text"],
        ] as const
      ).map(([which, label]) => (
        <label className="mn-field" key={which}>
          <span>{label}</span>
          <select
            value={draft.fonts[which]}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                fonts: { ...current.fonts, [which]: event.target.value },
              }))
            }
            style={{ fontFamily: draft.fonts[which] }}
          >
            {FONT_STACKS.map(([stack, name]) => (
              <option key={name} value={stack} style={{ fontFamily: stack }}>
                {name}
              </option>
            ))}
            {/* A Theme applied from a design may use a stack that is not on this list; it
                stays selectable rather than being silently replaced on the next save. */}
            {FONT_STACKS.every(([stack]) => stack !== draft.fonts[which]) ? (
              <option value={draft.fonts[which]}>{draft.fonts[which].split(",")[0]}</option>
            ) : null}
          </select>
        </label>
      ))}

      <div className="mn-image-actions">
        <button
          type="button"
          className="mn-button mn-button-primary"
          disabled={busy || !dirty}
          onClick={() => void save()}
        >
          {busy ? "Saving…" : "Save colours and type"}
        </button>

        {dirty ? (
          <button type="button" className="mn-button" onClick={() => setDraft(theme)}>
            Discard changes
          </button>
        ) : null}
      </div>

      <p className="mn-media-meta">
        Spacing, corner radius, line weight, elevation and page width stay in{" "}
        <code>theme.ts</code>. They are design decisions a colour picker does not help anybody
        make, and that file explains each one.
      </p>
    </section>
  );
}
