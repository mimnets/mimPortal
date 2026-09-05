import MarkdownIt, { type Token } from "markdown-it";
import { createElement, type ReactNode } from "react";

/**
 * The Markdown renderer, shared by the public Site and the Editor's preview
 * ([ADR-0011](../../../../docs/adr/0011-markdown-for-prose-json-for-layout.md)).
 *
 * Two decisions are load-bearing and neither is a setting anyone should change casually.
 *
 * **`html: false`.** The ADR asks for "a sanitising pipeline with raw HTML disabled". This
 * goes one better than sanitising: raw HTML is never parsed in the first place, so a `<script>`
 * an Author pasted arrives as the literal text `<script>` and there is no scrubbing step that
 * could be misconfigured, no allowlist to keep current, and nothing to get wrong on a
 * dependency upgrade. What is not admitted cannot be filtered incorrectly.
 *
 * **Tokens to React, not to an HTML string.** markdown-it's own `render()` returns HTML, which
 * would then need `dangerouslySetInnerHTML` to display — and that call, once present, is a
 * standing invitation for the next person to feed it something else. Walking the token stream
 * into React elements means the escaping is React's, on every text node, by construction.
 */
const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
  typographer: false,
});

/**
 * Tags markdown-it can emit that this renderer refuses to build.
 *
 * With `html: false` none of these should ever appear — raw HTML becomes text. This is the
 * belt to that braces: if a future markdown-it, a plugin or a changed option ever produced
 * one, it renders as nothing rather than as itself.
 */
const NEVER = new Set(["script", "style", "iframe", "object", "embed", "form", "input", "link"]);

/** Attributes worth carrying from a token, per tag. Everything else is dropped. */
const KEEP: Record<string, readonly string[]> = {
  a: ["href", "title"],
  img: ["src", "alt", "title"],
  ol: ["start"],
  code: [],
  pre: [],
};

function propsFor(token: Token, key: number): Record<string, unknown> {
  const props: Record<string, unknown> = { key };
  const allowed = KEEP[token.tag] ?? [];

  for (const [name, value] of token.attrs ?? []) {
    if (allowed.includes(name)) props[name] = value;
  }

  // A link an Author wrote points somewhere they chose; a link markdown-it linkified points
  // wherever the text said. Either way, off-site links open in a new tab without handing the
  // destination a referrer or a window opener.
  if (token.tag === "a") {
    const href = String(props.href ?? "");
    if (/^https?:\/\//i.test(href)) {
      props.target = "_blank";
      props.rel = "noreferrer";
    }
  }

  return props;
}

/**
 * Builds React elements from markdown-it's flat token stream.
 *
 * The stream is flat with `nesting` marking open (+1) and close (-1), so this walks it with an
 * index carried by reference and recurses on each open tag.
 */
function build(tokens: Token[], start: number, stop: number): ReactNode[] {
  const out: ReactNode[] = [];
  let i = start;
  let key = 0;

  while (i < stop) {
    const token = tokens[i]!;

    if (token.type === "inline") {
      out.push(...build(token.children ?? [], 0, (token.children ?? []).length));
      i += 1;
      continue;
    }

    if (token.type === "text") {
      // React escapes this. That is the entire defence and it is not optional.
      if (token.content) out.push(token.content);
      i += 1;
      continue;
    }

    if (token.type === "softbreak") {
      out.push(" ");
      i += 1;
      continue;
    }

    if (token.type === "hardbreak") {
      out.push(createElement("br", { key: key++ }));
      i += 1;
      continue;
    }

    // With html: false these should not occur. If they ever do, they are dropped rather than
    // trusted — see NEVER above.
    if (token.type === "html_block" || token.type === "html_inline") {
      i += 1;
      continue;
    }

    if (token.type === "fence" || token.type === "code_block") {
      out.push(
        createElement(
          "pre",
          { key: key++ },
          createElement("code", null, token.content),
        ),
      );
      i += 1;
      continue;
    }

    if (token.type === "code_inline") {
      out.push(createElement("code", { key: key++ }, token.content));
      i += 1;
      continue;
    }

    if (token.nesting === 1) {
      // Find this tag's matching close, accounting for the same tag nested inside itself.
      let depth = 1;
      let j = i + 1;
      while (j < stop && depth > 0) {
        const next = tokens[j]!;
        if (next.type === token.type) depth += 1;
        else if (next.type === token.type.replace(/_open$/, "_close")) depth -= 1;
        j += 1;
      }
      const end = j - 1;

      if (!NEVER.has(token.tag)) {
        out.push(
          createElement(token.tag, propsFor(token, key++), ...build(tokens, i + 1, end)),
        );
      }
      i = end + 1;
      continue;
    }

    if (token.nesting === 0 && token.tag && !NEVER.has(token.tag)) {
      out.push(createElement(token.tag, propsFor(token, key++)));
      i += 1;
      continue;
    }

    i += 1;
  }

  return out;
}

/**
 * Renders Markdown source to React elements.
 *
 * Returns an empty array for empty source, so a caller can decide whether an empty prose Block
 * should draw nothing at all rather than an empty wrapper.
 */
export function renderMarkdown(source: string): ReactNode[] {
  if (!source.trim()) return [];
  const tokens = md.parse(source, {});
  return build(tokens, 0, tokens.length);
}

/**
 * The plain text of some Markdown, for search and excerpts.
 *
 * ADR-0011 says search operates on Markdown source because it is close enough to plain text.
 * This is that, with the punctuation that is purely structural removed.
 */
export function markdownToText(source: string): string {
  return source
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^[>\s]*[-*+]\s+/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
