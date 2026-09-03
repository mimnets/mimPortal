"use client";

import { useEffect, useRef, useState } from "react";

import { assistActionsFor, type AssistAction } from "@mimnets/core";
import { ASSIST_ERROR } from "@mimnets/core/ai";

/**
 * The assistant, as a row of buttons under a text field.
 *
 * It streams into the field so an Author can see what they are getting and stop it. Nothing
 * is written until the stream ends: pressing Cancel restores what was there before, because
 * an Author who changes their mind halfway should not be left with half a sentence and no
 * way back.
 *
 * The Editor knows the action names and nothing else — no key, no vendor, no model. Which
 * provider answered is the server's business.
 */
export function Assist({
  kind,
  value,
  fieldLabel,
  pageTitle,
  siteName,
  onChange,
}: {
  kind: "text" | "textarea";
  value: string;
  fieldLabel?: string;
  pageTitle?: string;
  siteName?: string;
  onChange: (value: string) => void;
}) {
  const [running, setRunning] = useState<AssistAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const before = useRef<string>("");

  const actions = assistActionsFor(kind);

  /**
   * Stop writing into a field that is no longer on screen.
   *
   * `onChange` closes over the Block that was selected when the request started, so a stream
   * still running after the Author moves on keeps writing to the Block behind them — text
   * appearing in something they are not looking at, which they then save. The settings panel
   * is keyed on the Block's id, so selecting another one unmounts this and cancels here.
   */
  useEffect(() => () => abort.current?.abort(), []);

  function cancel() {
    abort.current?.abort();
    abort.current = null;
    // Put back exactly what was there. A half-written rewrite is not an edit anyone asked for.
    onChange(before.current);
    setRunning(null);
  }

  async function run(action: AssistAction) {
    if (running) return;

    before.current = value;
    setError(null);
    setRunning(action);

    const controller = new AbortController();
    abort.current = controller;

    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        signal: controller.signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, input: value, fieldLabel, pageTitle, siteName }),
      });

      if (!response.ok || !response.body) {
        const message = await response
          .json()
          .then((body: { error?: string }) => body.error)
          .catch(() => null);
        throw new Error(message ?? `The assistant is unavailable (${response.status}).`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let text = "";

      // Replace as it arrives rather than appending to what is there, so the field shows the
      // new version being written rather than the old and new run together.
      onChange("");

      while (true) {
        const { done, value: bytes } = await reader.read();
        if (done) break;
        text += decoder.decode(bytes, { stream: true });

        // Everything after the sentinel is a report, not writing. The response is already
        // 200 by the time a provider can fail, so this is how the server says so — and
        // treating it as text is what used to put "[Every provider failed...]" into a
        // heading as content the Author could publish.
        const failure = text.indexOf(ASSIST_ERROR);
        if (failure >= 0) {
          onChange(before.current);
          setError(text.slice(failure + ASSIST_ERROR.length) || "The assistant failed.");
          return;
        }

        onChange(text);
      }

      // A model told to return nothing for a decorative image returns nothing; that is an
      // answer, but silently emptying a field would look like a failure.
      if (text.trim() === "") {
        onChange(before.current);
        setError("The assistant had nothing to add.");
      }
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      onChange(before.current);
      setError(cause instanceof Error ? cause.message : "The assistant failed.");
    } finally {
      abort.current = null;
      setRunning(null);
    }
  }

  return (
    <div className="mn-assist">
      {running ? (
        <button type="button" className="mn-button mn-assist-cancel" onClick={cancel}>
          Stop
        </button>
      ) : (
        actions.map((info) => (
          <button
            key={info.action}
            type="button"
            className="mn-button mn-assist-button"
            title={info.help}
            disabled={info.action !== "alt" && value.trim() === ""}
            onClick={() => void run(info.action)}
          >
            {info.label}
          </button>
        ))
      )}

      {error ? <span className="mn-assist-error">{error}</span> : null}
    </div>
  );
}
