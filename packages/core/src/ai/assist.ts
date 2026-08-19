/**
 * What the assistant can be asked to do, and exactly how it is asked.
 *
 * The prompts live here rather than in the Editor for the same reason a Block's fields do:
 * one definition, used by the button that offers the action and by the server that runs it.
 * An action the Editor offers but the server does not recognise is not possible.
 *
 * Every prompt ends by constraining the output to the replacement text alone. A model that
 * helpfully replies "Here are three options:" produces a heading that reads "Here are three
 * options:", because the Editor puts the answer straight into the field.
 */

import type { AssistAction } from "./actions";

interface AssistDefinition {
  build(input: string, context: AssistContext): string;
}

export interface AssistContext {
  siteName?: string;
  pageTitle?: string;
  /** The field's own label — "Heading" and "Body" want different lengths. */
  fieldLabel?: string;
}

const OUTPUT_RULE =
  "Reply with the replacement text and nothing else: no preamble, no quotation marks " +
  "around it, no options to choose from, no explanation of what you changed.";

export const ASSIST_ACTIONS: Record<AssistAction, AssistDefinition> = {
  rewrite: {
    build: (input, context) =>
      `Rewrite the following ${where(context)} so it reads better. Keep the meaning, the ` +
      `language and roughly the length. Keep any specific facts, names and numbers exactly ` +
      `as they are.\n\n${OUTPUT_RULE}\n\n---\n${input}`,
  },

  shorten: {
    build: (input, context) =>
      `Shorten the following ${where(context)}. Aim for around half the length. Cut ` +
      `qualifiers and repetition rather than facts.\n\n${OUTPUT_RULE}\n\n---\n${input}`,
  },

  expand: {
    build: (input, context) =>
      `Expand the following ${where(context)} by roughly half again. Add substance — a ` +
      `concrete detail or a consequence — rather than adjectives. Invent nothing factual ` +
      `that is not implied by the text.\n\n${OUTPUT_RULE}\n\n---\n${input}`,
  },

  proofread: {
    build: (input) =>
      `Correct spelling, grammar and punctuation in the following text. Change nothing ` +
      `else: not the wording, not the tone, not the length, not the ordering. If it is ` +
      `already correct, reply with it unchanged.\n\n${OUTPUT_RULE}\n\n---\n${input}`,
  },

  alt: {
    build: (input, context) =>
      `Write alt text for an image on ${context.pageTitle ? `a page titled "${context.pageTitle}"` : "a web page"}. ` +
      `What is known about it: ${input || "nothing beyond its position on the page"}.\n\n` +
      `One sentence, under 125 characters, describing what a sighted visitor would see. Do ` +
      `not begin with "Image of" or "Picture of". If the image is decorative and carries no ` +
      `information, reply with an empty response.\n\n${OUTPUT_RULE}`,
  },

  seo: {
    build: (input, context) =>
      `Write the meta description for a web page${context.pageTitle ? ` titled "${context.pageTitle}"` : ""}` +
      `${context.siteName ? ` on a site called "${context.siteName}"` : ""}.\n\n` +
      `The page says:\n${input}\n\n` +
      `One sentence, between 120 and 155 characters, describing what the visitor will find. ` +
      `Write it for a person deciding whether to click, not for a search engine. No ` +
      `keyword stuffing, no "Welcome to".\n\n${OUTPUT_RULE}`,
  },
};

function where(context: AssistContext): string {
  return context.fieldLabel ? `text from a "${context.fieldLabel}" field` : "text";
}

/**
 * The system prompt is the same for every action, so it stays identical across a Site's
 * requests — which is what lets a provider cache it.
 */
export const ASSIST_SYSTEM =
  "You are helping someone edit the text on their own website. You are careful and plain: " +
  "you do not add marketing language they did not ask for, you do not invent facts, claims, " +
  "statistics or testimonials, and you keep the language the text is already written in. " +
  "You are editing content that will be published as written.";

export function assistPrompt(
  action: AssistAction,
  input: string,
  context: AssistContext = {},
): { system: string; prompt: string } {
  const definition = ASSIST_ACTIONS[action];
  if (!definition) throw new Error(`Unknown assist action: ${action}`);
  return { system: ASSIST_SYSTEM, prompt: definition.build(input, context) };
}
