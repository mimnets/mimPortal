import type { ReactNode } from "react";
import type { z } from "zod";

import type { RenderContext } from "../render/context";
import { fieldsToSchema, type FieldsShape, type InferFields } from "./fields";

export interface BlockTypeConfig<F extends FieldsShape> {
  /** Stable identifier stored in every Block instance. Renaming it breaks existing Pages. */
  name: string;
  /** What an Author sees in the Editor's block picker. */
  label: string;
  fields: F;
  /**
   * Blocks are pure functions of their own fields, plus whatever the Site resolved once for
   * this request — Menus, the Site name, the current path. A Block never queries anything.
   */
  render: (props: InferFields<F>, context: RenderContext) => ReactNode;
}

export interface BlockType<F extends FieldsShape = FieldsShape> extends BlockTypeConfig<F> {
  /** Props schema derived from `fields` — the only thing that validates a Block's data. */
  propsSchema: z.ZodType<InferFields<F>>;
}

/**
 * Declares a Block Type: its editable fields and how it renders, in one place.
 *
 * The Editor generates the settings form from `fields`, so adding a Block is minutes of
 * work rather than a day. Nothing else in the system may hand-write a form for a Block.
 */
export function defineBlock<F extends FieldsShape>(config: BlockTypeConfig<F>): BlockType<F> {
  return {
    ...config,
    propsSchema: fieldsToSchema(config.fields) as unknown as z.ZodType<InferFields<F>>,
  };
}

/**
 * A registry holds Block Types whose field shapes differ, and a function taking specific
 * props is not assignable to one taking any props. The collection type has to be permissive;
 * every individual Block stays fully typed at its definition site.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyBlockType = BlockType<any>;
