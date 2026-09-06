import { isSafeStorageKey, UNSAFE_KEY_MESSAGE } from "../layout/storage-key";
import type { ColorToken } from "../theme";
import { z } from "zod";

/**
 * A Block Type declares its editable fields once. The Editor generates its settings form
 * from these declarations, and the same schema validates what is written to the database
 * and anything a model generates (ADR-0007). There is no second, hand-written form.
 */
export type FieldKind =
  | "text"
  | "textarea"
  | "select"
  | "token"
  | "number"
  | "boolean"
  | "image"
  | "link"
  | "repeater";

export interface Field<TSchema extends z.ZodType = z.ZodType> {
  kind: FieldKind;
  label: string;
  help?: string;
  schema: TSchema;
  /** Present only on repeaters, so the Editor can build a sub-form per item. */
  fields?: FieldsShape;
  /** Present on selects and tokens, so the Editor can render the choices. */
  options?: readonly string[];
}

export type FieldsShape = Record<string, Field>;

/** The props a Block's `render` receives, derived from its field declarations. */
export type InferFields<F extends FieldsShape> = {
  [K in keyof F]: z.infer<F[K]["schema"]>;
};

type SchemaShape<F extends FieldsShape> = { [K in keyof F]: F[K]["schema"] };

export function fieldsToShape<F extends FieldsShape>(fields: F): SchemaShape<F> {
  return Object.fromEntries(
    Object.entries(fields).map(([key, field]) => [key, field.schema]),
  ) as SchemaShape<F>;
}

/** The object schema for a whole set of fields — a Block's props schema. */
export function fieldsToSchema<F extends FieldsShape>(fields: F) {
  return z.object(fieldsToShape(fields));
}

function makeField<TSchema extends z.ZodType>(
  kind: FieldKind,
  label: string,
  schema: TSchema,
  extra: Omit<Field, "kind" | "label" | "schema"> = {},
): Field<TSchema> {
  return { kind, label, schema, ...extra };
}

/**
 * An image is a storage key, never a URL.
 *
 * The key is what survives a Site moving from its own disk to a bucket, or a bucket gaining
 * a CDN domain: the Block composes its URL from `context.mediaBaseUrl` at render time. A
 * layout full of absolute URLs would have to be rewritten Page by Page instead.
 *
 * Width and height are copied in when the image is chosen so the renderer can reserve space
 * before the file arrives. They never change for a given key, so a stale copy is not
 * possible — a new upload is a new key.
 */
const imageSchema = z.object({
  // A key, never a URL (ADR-0012) — and now enforced rather than assumed. It is interpolated
  // into an img src by every Block that shows a picture. See storage-key.ts.
  key: z
    .string()
    .default("")
    .refine((key) => key === "" || isSafeStorageKey(key), UNSAFE_KEY_MESSAGE),
  alt: z.string().default(""),
  /**
   * Whether this image carries no meaning a reader would miss.
   *
   * Empty alt text already means "decorative" to a screen reader, which is why a Page of
   * undescribed photographs used to pass every check: forgetting produced the same markup as
   * deciding. It cannot any more — an image is described, or it is deliberately marked as
   * decoration, and the Editor can tell the two apart and say so.
   *
   * Defaulted so every image written before this still parses; those show as undescribed,
   * which is what they are.
   */
  decorative: z.boolean().default(false),
  width: z.number().nullable().default(null),
  height: z.number().nullable().default(null),
});

const linkSchema = z.object({
  label: z.string().default(""),
  href: z.string().default(""),
  newTab: z.boolean().default(false),
});

export const field = {
  text(options: { label?: string; help?: string; default?: string } = {}) {
    return makeField("text", options.label ?? "Text", z.string().default(options.default ?? ""), {
      help: options.help,
    });
  },

  textarea(options: { label?: string; help?: string; default?: string } = {}) {
    return makeField(
      "textarea",
      options.label ?? "Text",
      z.string().default(options.default ?? ""),
      { help: options.help },
    );
  },

  select<const T extends readonly [string, ...string[]]>(options: {
    label?: string;
    help?: string;
    options: T;
    default?: T[number];
  }) {
    return makeField(
      "select",
      options.label ?? "Choice",
      z.enum(options.options).default(options.default ?? options.options[0]),
      { help: options.help, options: options.options },
    );
  },

  /**
   * One of the Theme's own colours, by name.
   *
   * The distinction from `select` is not the control, which is nearly the same -- it is what
   * the value means. A select's options are this Block Type's business; a token's are the
   * Theme's, so the same Page rebrands when the Theme does and a Block can never name a
   * colour the Site has not chosen. That is the whole of ADR-0003 in a field.
   *
   * The Block Type narrows the list to what makes sense where it will be used: an eyebrow
   * offers the four that read at its size, not all six. Whichever token was the Block's
   * existing hard-coded colour should be the default, for the reason the first declared
   * variant is a Block's existing look -- a field that repaints every Site the day it lands
   * is a field nobody adds.
   */
  token<const T extends readonly [ColorToken, ...ColorToken[]]>(options: {
    label?: string;
    help?: string;
    tokens: T;
    default?: T[number];
  }) {
    return makeField(
      "token",
      options.label ?? "Colour",
      z.enum(options.tokens).default(options.default ?? options.tokens[0]),
      { help: options.help, options: options.tokens },
    );
  },

  number(options: { label?: string; help?: string; default?: number } = {}) {
    return makeField(
      "number",
      options.label ?? "Number",
      z.number().default(options.default ?? 0),
      { help: options.help },
    );
  },

  boolean(options: { label?: string; help?: string; default?: boolean } = {}) {
    return makeField(
      "boolean",
      options.label ?? "Yes or no",
      z.boolean().default(options.default ?? false),
      { help: options.help },
    );
  },

  image(options: { label?: string; help?: string } = {}) {
    const empty = { key: "", alt: "", decorative: false, width: null, height: null };
    return makeField("image", options.label ?? "Image", imageSchema.default(empty), {
      help: options.help,
    });
  },

  link(options: { label?: string; help?: string } = {}) {
    return makeField(
      "link",
      options.label ?? "Link",
      linkSchema.default({ label: "", href: "", newTab: false }),
      { help: options.help },
    );
  },

  /**
   * A repeating group of fields — a carousel's slides, a testimonial strip's quotes.
   * Blocks never contain other Blocks: nested drag-and-drop inside drag-and-drop is where
   * page builders go to die, so repeating content is a field, not a nesting rule.
   */
  repeater<F extends FieldsShape>(options: { label?: string; help?: string; fields: F }) {
    return makeField(
      "repeater",
      options.label ?? "Items",
      z.array(fieldsToSchema(options.fields)).default([]),
      { help: options.help, fields: options.fields },
    );
  },
};
