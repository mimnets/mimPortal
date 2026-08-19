/**
 * What the assistant offers, as data a browser can hold.
 *
 * Separate from `assist.ts` on purpose. That file builds the prompts and lives behind
 * "@mimnets/core/ai", which pulls in an SDK and an API key; this one is imported by the
 * Editor to draw buttons. Putting the labels there would drag the whole provider stack into
 * the browser bundle — the same rule that keeps the database behind its own subpath.
 */

export type AssistAction = "rewrite" | "shorten" | "expand" | "proofread" | "alt" | "seo";

export interface AssistActionInfo {
  action: AssistAction;
  label: string;
  /** Shown in the Editor, so an Author knows what they are about to get. */
  help: string;
  /** Which field kinds it makes sense on — offering "Expand" on a heading does not. */
  kinds: readonly ("text" | "textarea")[];
}

export const ASSIST_ACTION_LIST: readonly AssistActionInfo[] = [
  { action: "rewrite", label: "Rewrite", help: "Same meaning, better written.", kinds: ["text", "textarea"] },
  { action: "shorten", label: "Shorten", help: "Cut it down without losing the point.", kinds: ["text", "textarea"] },
  { action: "expand", label: "Expand", help: "Add a little, without padding.", kinds: ["textarea"] },
  { action: "proofread", label: "Fix spelling", help: "Spelling and grammar only.", kinds: ["text", "textarea"] },
  { action: "alt", label: "Describe image", help: "Alt text for an image.", kinds: ["text"] },
  { action: "seo", label: "Write description", help: "A search-result description.", kinds: ["text", "textarea"] },
];

export function assistActionsFor(kind: "text" | "textarea"): readonly AssistActionInfo[] {
  return ASSIST_ACTION_LIST.filter((info) => info.kinds.includes(kind));
}

/** Guards what arrives over HTTP: an action name from a request is not to be trusted. */
export function isAssistAction(value: unknown): value is AssistAction {
  return ASSIST_ACTION_LIST.some((info) => info.action === value);
}
