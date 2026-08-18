export { createDatabase, pages } from "./db/index";
export type { Database, NewPageRow, PageRow } from "./db/index";

export { defineBlock } from "./blocks/define";
export type { AnyBlockType, BlockType, BlockTypeConfig } from "./blocks/define";

export { field, fieldsToSchema } from "./blocks/fields";
export type { Field, FieldKind, FieldsShape, InferFields } from "./blocks/fields";

export { createRegistry } from "./blocks/registry";
export type { BlockRegistry } from "./blocks/registry";

export {
  COLUMN_LAYOUTS,
  SLOT_NAMES,
  buildLayoutSchema,
  columnCount,
  columnTemplate,
  emptyLayout,
} from "./layout/schema";
export type {
  BlockInstance,
  ColumnLayout,
  ColumnNode,
  PageLayout,
  SectionNode,
  SlotName,
} from "./layout/schema";

export { SlotView } from "./render/render";
