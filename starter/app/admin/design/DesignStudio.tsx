"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { PresetOption } from "../preset-actions";

/**
 * Describe the business, get several designs, apply one.
 *
 * Several rather than one, and previewed rather than applied blind: the point of generating
 * a design is choosing between directions, and an Owner who is shown a single result has no
 * way to tell a good one from the only one.
 */
export function DesignStudio({
  enabled,
  providerName,
  providers,
  siteName,
  usingGeneratedTheme,
  onGenerate,
  onApply,
  onApplyTheme,
  onReset,
}: {
  enabled: boolean;
  providerName: string | null;
  providers: { name: string; model: string; free: boolean }[];
  siteName: string;
  usingGeneratedTheme: boolean;
  onGenerate: (input: { brief: string; count?: number; provider?: string }) => Promise<{
    options: PresetOption[];
    failures: string[];
  }>;
  onApply: (payload: string) => Promise<{ pages: number }>;
  onApplyTheme: (payload: string) => Promise<void>;
  onReset: () => Promise<void>;
}) {
  const router = useRouter();
  const [brief, setBrief] = useState("");
  const [chosen, setChosen] = useState("");
  const [options, setOptions] = useState<PresetOption[]>([]);
  const [failures, setFailures] = useState<string[]>([]);
  const [busy, setBusy] = useState<"generating" | "applying" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  if (!enabled) {
    return (
      <p className="mn-media-error">
        No AI provider is configured for this Site, so nothing can be generated. Add a key —
        one free OpenRouter key is enough — and restart. See <code>docs/AI.md</code>.
      </p>
    );
  }

  async function generate() {
    setBusy("generating");
    setError(null);
    setStatus(null);
    setOptions([]);
    setFailures([]);

    try {
      const result = await onGenerate({ brief, count: 3, provider: chosen || undefined });
      setOptions(result.options);
      setFailures(result.failures);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nothing could be generated.");
    } finally {
      setBusy(null);
    }
  }

  async function apply(option: PresetOption, themeOnly: boolean) {
    const question = themeOnly
      ? `Apply the "${option.name}" colours and type to this Site?`
      : `Apply "${option.name}"? ${option.pages.length} Page${option.pages.length === 1 ? "" : "s"} will be written as drafts, and existing Pages keep what is published.`;
    if (!confirm(question)) return;

    setBusy("applying");
    setError(null);

    try {
      if (themeOnly) {
        await onApplyTheme(option.payload);
        setStatus(`Applied the ${option.name} theme.`);
      } else {
        const { pages } = await onApply(option.payload);
        setStatus(
          `Applied ${option.name}. ${pages} Page${pages === 1 ? "" : "s"} written as drafts — open one to review and publish it.`,
        );
      }
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That could not be applied.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      {error ? <p className="mn-media-error">{error}</p> : null}
      {status ? <p className="mn-preset-status">{status}</p> : null}

      <section className="mn-field-group">
        <legend>Generate a design</legend>

        <label className="mn-field">
          <span>What is this Site for?</span>
          <textarea
            rows={3}
            value={brief}
            placeholder={`A family law firm in Leeds, established 1994. Calm and trustworthy, not corporate.`}
            onChange={(event) => setBrief(event.target.value)}
          />
          <small>
            The more specific, the less generic the result. Name the trade, the place and the
            tone — “a skate shop” and “a law firm” should not come back looking alike.
          </small>
        </label>

        <label className="mn-field">
          <span>Model</span>
          <select value={chosen} onChange={(event) => setChosen(event.target.value)}>
            <option value="">
              Try each in turn — free first ({providers.length} configured)
            </option>
            {providers.map((one) => (
              <option key={one.name} value={one.name}>
                {one.name} · {one.model}
                {one.free ? " · free" : ""}
              </option>
            ))}
          </select>
          <small>
            Generating a whole Site is worth a better model than rewriting a heading. Leave it
            on the default and a free model answers unless it cannot.
          </small>
        </label>

        <div className="mn-image-actions">
          <button
            type="button"
            className="mn-button mn-button-primary"
            disabled={busy !== null || brief.trim().length < 3}
            onClick={() => void generate()}
          >
            {busy === "generating" ? "Designing…" : "Generate three designs"}
          </button>

          {usingGeneratedTheme ? (
            <button
              type="button"
              className="mn-button"
              disabled={busy !== null}
              onClick={() => {
                if (!confirm("Go back to the theme in theme.ts?")) return;
                void onReset().then(() => {
                  setStatus("Back to the theme in theme.ts.");
                  router.refresh();
                });
              }}
            >
              Reset to theme.ts
            </button>
          ) : null}
        </div>

        <p className="mn-media-meta">
          {usingGeneratedTheme
            ? "This Site is using a generated theme. Resetting returns it to theme.ts."
            : "This Site is using the theme in theme.ts."}
          {providerName ? ` · via ${providerName}` : ""}
          {siteName ? ` · ${siteName}` : ""}
        </p>
      </section>

      {busy === "generating" ? (
        <p className="mn-media-empty">
          Designing three directions at once. A free model takes a little while.
        </p>
      ) : null}

      {failures.length > 0 ? (
        <p className="mn-media-meta">
          {failures.length} of the designs came back invalid and were discarded — the rest are
          below. That is the schema doing its job rather than something being wrong.
        </p>
      ) : null}

      {options.map((option) => (
        <section className="mn-field-group" key={option.name + option.payload.length}>
          <legend>{option.name}</legend>
          <p className="mn-media-meta">{option.description}</p>

          <div className="mn-swatches">
            {(
              [
                ["background", option.theme.colors.background],
                ["surface", option.theme.colors.surface],
                ["primary", option.theme.colors.primary],
                ["accent", option.theme.colors.accent],
                ["text", option.theme.colors.text],
              ] as const
            ).map(([name, value]) => (
              <span className="mn-swatch" key={name}>
                <span style={{ background: value }} />
                <code>{value}</code>
                <small>{name}</small>
              </span>
            ))}
          </div>

          <div
            className="mn-preset-type"
            style={{ fontFamily: option.theme.fonts.heading, color: option.theme.colors.text }}
          >
            {siteName || "Your Site"}
            <span style={{ fontFamily: option.theme.fonts.body }}>
              Body text is set in {option.theme.fonts.body.split(",")[0]}.
            </span>
          </div>

          <ul className="mn-page-list">
            {option.pages.map((page) => (
              <li className="mn-page-row" key={page.path}>
                <span className="mn-page-main">
                  <strong>{page.title}</strong>
                  <code>{page.path}</code>
                </span>
                <span className="mn-media-meta">
                  {page.sections} sections · {page.blocks} blocks
                </span>
              </li>
            ))}
          </ul>

          <div className="mn-image-actions">
            <button
              type="button"
              className="mn-button mn-button-primary"
              disabled={busy !== null}
              onClick={() => void apply(option, false)}
            >
              Use this design
            </button>
            <button
              type="button"
              className="mn-button"
              disabled={busy !== null}
              onClick={() => void apply(option, true)}
              title="Keep the Pages you have and take only the colours and type"
            >
              Colours only
            </button>
          </div>
        </section>
      ))}
    </>
  );
}
