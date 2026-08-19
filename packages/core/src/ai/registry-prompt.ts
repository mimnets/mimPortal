import type { BlockRegistry } from "../blocks/registry";
import type { Field, FieldsShape } from "../blocks/fields";
import { COLUMN_LAYOUTS, SECTION_TONES } from "../layout/schema";

/**
 * Describes a Site's Block Types to a model, generated from the registry itself.
 *
 * This is what makes generated layouts valid rather than lucky. A model cannot invent a
 * Block Type that does not exist (ADR-0007) — the schema rejects that afterwards — but a
 * generator told nothing about the library would invent one on almost every attempt and be
 * rejected every time. Describing the real registry turns validation from the thing that
 * catches failures into the thing that confirms successes.
 *
 * It is generated rather than written out because a hand-maintained copy would be wrong the
 * first time somebody added a Block, and wrong silently: the output would still validate,
 * it would just never use the new Block.
 */
export function describeRegistry(registry: BlockRegistry): string {
  const blocks = registry.blocks
    .map((block) => {
      const fields = describeFields(block.fields as FieldsShape, "    ");
      return `  ${block.name} — ${block.label}\n${fields}`;
    })
    .join("\n\n");

  return [
    "AVAILABLE BLOCK TYPES",
    "Use only these. A block with any other `type` is rejected outright.",
    "",
    blocks,
  ].join("\n");
}

function describeFields(fields: FieldsShape, indent: string): string {
  return Object.entries(fields)
    .map(([key, field]) => `${indent}${key}: ${describeField(field, indent)}`)
    .join("\n");
}

function describeField(field: Field, indent: string): string {
  switch (field.kind) {
    case "select":
      return `one of ${(field.options ?? []).map((o) => `"${o}"`).join(" | ")}`;
    case "boolean":
      return "true or false";
    case "number":
      return "a number";
    case "textarea":
      return "a string, may contain \\n\\n between paragraphs";
    case "image":
      // A generated layout cannot reference a file that does not exist, so images stay empty
      // and an Author fills them from the media library.
      return '{ "key": "", "alt": "", "width": null, "height": null } — always empty; the Site has no images yet';
    case "link":
      return '{ "label": string, "href": string, "newTab": false }';
    case "repeater":
      return `an array of objects, each:\n${describeFields(field.fields ?? {}, `${indent}  `)}`;
    default:
      return "a string";
  }
}

/** The structural rules, which are the same for every Site. */
export function describeLayoutRules(): string {
  return [
    "LAYOUT SHAPE",
    "A page is a list of sections. Each section is:",
    "",
    '  {',
    '    "layout": one of ' + Object.keys(COLUMN_LAYOUTS).map((l) => `"${l}"`).join(" | ") + ",",
    '    "tone": one of ' + SECTION_TONES.map((t) => `"${t}"`).join(" | ") + ",",
    '    "padding": one of "normal" | "large" | "flush",',
    '    "columns": [ { "blocks": [ { "type": "...", "props": { ... } } ] } ]',
    "  }",
    "",
    "Rules that are enforced, not suggestions:",
    "- The number of columns must match the layout exactly: \"1\" has one, \"1-1\" has two,",
    "  \"1-1-1\" three, \"1-1-1-1\" four, \"2-1\" and \"1-2\" two.",
    "- Blocks never contain other blocks.",
    "- Every prop declared for a block type must be present.",
    "- Do not invent ids. They are assigned after generation.",
  ].join("\n");
}

/** What separates a page that looks designed from a stack of text. */
export function describeComposition(): string {
  return [
    "COMPOSITION",
    "- Vary the tone between sections. A page where every section is \"default\" reads as a",
    "  document; alternating default / surface / primary / dark is what makes it look designed.",
    "- Open with a hero: an eyebrow, a heading, a sentence or two, and a button. Give that",
    "  section padding \"large\".",
    "- Close with a call to action in a \"primary\" or \"dark\" section.",
    "- Between them, use the composition blocks — feature grids, statistics, testimonials,",
    "  pricing — rather than paragraph after paragraph.",
    "- 5 to 7 sections for a home page, 3 to 5 for any other.",
  ].join("\n");
}
