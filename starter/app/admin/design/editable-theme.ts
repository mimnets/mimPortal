import type { Theme } from "@mimnets/core";

/**
 * The Theme as the Dashboard's form holds it, and the one place that decides what survives
 * being edited.
 *
 * `save` posts this whole object and `saveTheme` replaces the stored Theme with it, so a
 * family missing here is not read-only -- it is deleted, on the first colour anybody moves,
 * with no error and no diff. Three families were carried for exactly that reason and
 * `texture` was left out, so the Starter's grain came off the Site the first time an Owner
 * nudged a colour.
 *
 * It is a function in its own file rather than an object literal in the page so that the
 * rule can be asserted: `editable-theme.test.ts` reads the keys of a complete Theme and
 * fails when a new family is added to one and not the other. That test is the thing that
 * makes this comment true rather than merely well-intentioned.
 */
export interface EditableTheme {
  colors: Record<string, string>;
  fonts: { body: string; heading: string };
  radius: Record<string, string>;
  border: Record<string, string>;
  surface: string;
  texture: string;
  spacing: { section: string; gutter: string };
  measure: string;
}

/**
 * Families a Theme states but the Dashboard must not send back.
 *
 * `elevation` is derived from the palette by `defineTheme` and has no place in `ThemeInput`
 * at all (ADR-0019). Posting it back would be asking the schema to accept a `box-shadow`,
 * which is the one thing it deliberately cannot check.
 */
export const DERIVED_FAMILIES = ["elevation"] as const;

export function editableTheme(theme: Theme): EditableTheme {
  return {
    colors: { ...theme.colors },
    fonts: { body: theme.fonts.body, heading: theme.fonts.heading },
    radius: { ...theme.radius },
    border: { ...theme.border },
    surface: theme.surface,
    texture: theme.texture,
    spacing: { section: theme.spacing.section, gutter: theme.spacing.gutter },
    measure: theme.measure,
  };
}
