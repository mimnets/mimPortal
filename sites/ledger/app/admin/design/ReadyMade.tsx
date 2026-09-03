"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { BuiltInSummary } from "../preset-actions";

/**
 * The designs that ship with the Starter.
 *
 * Above the generator on the screen, deliberately. Most Sites want one of these and a few
 * edits; generating from scratch is the answer when none of them fits, not the first thing
 * to try. These are also instant, free, need no key, and were designed rather than sampled.
 */
export function ReadyMade({
  presets,
  onApply,
}: {
  presets: BuiltInSummary[];
  onApply: (slug: string) => Promise<{ pages: number }>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function apply(preset: BuiltInSummary) {
    if (
      !confirm(
        `Apply "${preset.name}"? Its ${preset.pages.length} Pages are written as drafts — anything already published stays up until you publish over it.`,
      )
    ) {
      return;
    }

    setBusy(preset.slug);
    setError(null);
    setStatus(null);

    try {
      const { pages } = await onApply(preset.slug);
      setStatus(
        `Applied ${preset.name}. ${pages} Page${pages === 1 ? "" : "s"} written as drafts — open one to review and publish it.`,
      );
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That could not be applied.");
    } finally {
      setBusy(null);
    }
  }

  const categories = [...new Set(presets.map((preset) => preset.category))];

  return (
    <>
      {error ? <p className="mn-media-error">{error}</p> : null}
      {status ? <p className="mn-preset-status">{status}</p> : null}

      <p className="mn-media-meta">
        Ready to use, no AI involved. Applying one writes its Pages as drafts and sets the
        Site’s colours and type — both of which you can change afterwards.
      </p>

      {categories.map((category) => (
        <section className="mn-field-group" key={category}>
          <legend>{category}</legend>

          <ul className="mn-preset-grid">
            {presets
              .filter((preset) => preset.category === category)
              .map((preset) => (
                <li className="mn-preset-card" key={preset.slug}>
                  {/* A miniature of the design rather than a description of it: bands in the
                      Theme's own colours, which is what a page built from it looks like. */}
                  <div
                    className="mn-preset-thumb"
                    style={{ background: preset.theme.colors.background }}
                    aria-hidden="true"
                  >
                    <span style={{ background: preset.theme.colors.text, height: "22%" }} />
                    <span style={{ background: preset.theme.colors.surface, height: "16%" }} />
                    <span style={{ background: preset.theme.colors.primary, height: "12%" }} />
                    <span style={{ background: preset.theme.colors.background, height: "24%" }} />
                    <span style={{ background: preset.theme.colors.accent, height: "8%" }} />
                  </div>

                  <div className="mn-preset-body">
                    <strong style={{ fontFamily: preset.theme.fonts.heading }}>{preset.name}</strong>
                    <p className="mn-media-meta">{preset.description}</p>

                    <div className="mn-swatches">
                      {(["primary", "accent", "text", "surface"] as const).map((name) => (
                        <span className="mn-swatch is-small" key={name}>
                          <span style={{ background: preset.theme.colors[name] }} />
                        </span>
                      ))}
                    </div>

                    <span className="mn-media-meta">
                      {preset.pages.map((page) => page.title).join(" · ")}
                    </span>

                    <button
                      type="button"
                      className="mn-button mn-button-primary"
                      disabled={busy !== null}
                      onClick={() => void apply(preset)}
                    >
                      {busy === preset.slug ? "Applying…" : "Use this design"}
                    </button>
                  </div>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </>
  );
}
