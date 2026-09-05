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
  BLOCK_ANIMATIONS,
  BLOCK_FONTS,
  BLOCK_TONES,
  blockStyleDefaults,
  COLUMN_LAYOUTS,
  SECTION_PADDINGS,
  SECTION_TONES,
  SLOT_NAMES,
  buildLayoutSchema,
  columnCount,
  columnTemplate,
  emptyLayout,
  sectionDefaults,
} from "./layout/schema";
export type {
  BlockAnimation,
  BlockFont,
  BlockInstance,
  BlockStyle,
  BlockTone,
  ColumnLayout,
  ColumnNode,
  PageLayout,
  SectionBackground,
  SectionNode,
  SectionPadding,
  SectionTone,
  SlotName,
} from "./layout/schema";

export { assertLockedSlotsUnchanged, lockedSlotViolation } from "./layout/locking";

export {
  defaultTheme,
  defineTheme,
  themeToCss,
  themeSchema,
  completeTheme,
  readableOn,
  SURFACE_STYLES,
} from "./theme/index";
export type { SurfaceStyle, Theme, ThemeInput } from "./theme/index";

export { emptyContext, menuItemSchema, menuItemsSchema } from "./render/context";
export type { MenuItem, RenderContext } from "./render/context";

export { SlotView } from "./render/render";
export { markdownToText, renderMarkdown } from "./render/markdown";
export { safeHref } from "./render/safe-href";

export { FORM_FIELDS, FORM_RESULT_PARAM } from "./forms/shared";
export type { FormResult } from "./forms/shared";

export { ASSIST_ACTION_LIST, assistActionsFor, isAssistAction } from "./ai/actions";
export type { AssistAction, AssistActionInfo } from "./ai/actions";

export { paletteFromPixels } from "./theme/palette";
export type { PaletteColors } from "./theme/palette";
