# Markdown for prose, JSON for layout

Prose inside a Block — a text body, a blog post — is stored as Markdown. The layout that
arranges Blocks stays a validated JSON document
([ADR-0004](./0004-page-layout-as-a-single-json-document.md)). The two are different kinds
of content and the split is deliberate: structure must be constrained, prose must not be.

Markdown earns its place three times over. Authors get headings, lists, links and emphasis
without a rich-text editor, which is the single most expensive component in any CMS. Models
emit Markdown natively — the writing assistant and generated Presets produce prose in the
same form the database stores, with no lossy conversion in between. And it survives:
Markdown is readable in a `pg_dump` a decade from now, which HTML-in-a-JSON-blob is not.

The alternative — a rich-text document model like ProseMirror or Lexical — buys inline
comments, collaborative editing and precise formatting control. None of those are in scope
([ADR-0006](./0006-v1-scope-boundary.md)), and each would cost more than the entire Block
library.

## Consequences

- **Markdown must be sanitised, not trusted.** Authors are clients, and Markdown permits
  raw HTML. Rendering goes through a sanitising pipeline with raw HTML disabled; a Site that
  needs custom markup ships a Block Type for it instead.
- Blocks render Markdown at request time, so the renderer stays in `core` and both the
  public Site and the Editor preview use the same one.
- Search and excerpts operate on Markdown source, which is close enough to plain text to be
  useful and avoids storing a second derived copy.
