// The database lives behind "@mimnets/core/db" on purpose: this entrypoint is imported by
// the Editor, which runs in a browser, and a Postgres driver has no business being bundled
// there. Server code imports that subpath explicitly.

export type { PageVersionRow } from "./db/schema";

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

export { assertLockedSlotsUnchanged, lockedSlotViolation } from "./layout/locking";

export { SlotView } from "./render/render";
