// The database lives behind "@mimnets/core/db" on purpose: this entrypoint is imported by
// the Editor, which runs in a browser, and a Postgres driver has no business being bundled
// there. Server code imports that subpath explicitly.

export type { PageVersionRow } from "./db/schema";

export { defineBlock } from "./blocks/define";
export type { AnyBlockType, BlockMeta, BlockType, BlockTypeConfig } from "./blocks/define";

export { field, fieldsToSchema } from "./blocks/fields";
export type { Field, FieldKind, FieldsShape, InferFields } from "./blocks/fields";

export { createRegistry } from "./blocks/registry";
export type { BlockRegistry } from "./blocks/registry";

export { mediaKeysIn, usesMediaKey } from "./layout/media-keys";

export { COLOR_TOKENS } from "./theme";
export type { ColorToken } from "./theme";

export {
  BLOCK_ANIMATIONS,
  BLOCK_FONTS,
  BLOCK_TONES,
  blockStyleDefaults,
  COLUMN_LAYOUTS,
  SECTION_DIVIDERS,
  SECTION_PADDINGS,
  SECTION_TONES,
  SECTION_WIDTHS,
  SLOT_NAMES,
  SLOT_STICKY,
  toSlotSticky,
  buildLayoutSchema,
  columnCount,
  columnShares,
  columnTemplate,
  layoutsWithColumns,
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
  SectionDivider,
  SectionPadding,
  SectionWidth,
  SectionTone,
  SlotName,
  SlotSticky,
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
  TEXTURES,
} from "./theme/index";
export type { SurfaceStyle, Texture, Theme, ThemeInput } from "./theme/index";

export { emptyContext, menuItemSchema, menuItemsSchema } from "./render/context";
export type { MenuItem, RenderContext } from "./render/context";

export { SlotView } from "./render/render";
export { markdownToText, renderMarkdown } from "./render/markdown";
export { safeHref } from "./render/safe-href";

export { FORM_FIELDS, FORM_RESULT_PARAM, FORM_EXTRA_PREFIX, extraFieldName, extraAnswers } from "./forms/shared";
export type { ExtraAnswer } from "./forms/shared";
export type { FormResult } from "./forms/shared";

export { ASSIST_ACTION_LIST, assistActionsFor, isAssistAction } from "./ai/actions";
export type { AssistAction, AssistActionInfo } from "./ai/actions";

export { paletteFromPixels } from "./theme/palette";
export type { PaletteColors } from "./theme/palette";
