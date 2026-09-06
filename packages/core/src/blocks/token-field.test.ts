/**
 * `field.token`: a token picker, and deliberately not a colour picker.
 *
 * ADR-0003's argument is that a client who can put anything anywhere will, and a free hex
 * picker is that argument wearing a different hat — it just moves the unconstrained choice
 * from layout to colour. So a Block that needs to offer a choice offers names from the
 * Theme, and the Theme decides what they resolve to.
 *
 * Two properties matter and both are asserted here: a value outside the Block's declared list
 * cannot be stored, and a Block that never stated one keeps the colour it always had.
 */

import { describe, expect, it } from "vitest";

import { defineBlock } from "./define";
import { field } from "./fields";
import { COLOR_TOKENS } from "../theme";

const badge = defineBlock({
  name: "badge",
  label: "Badge",
  fields: {
    text: field.text({ label: "Text", default: "" }),
    colour: field.token({
      label: "Colour",
      tokens: ["accent", "primary", "accentText"],
      default: "accent",
    }),
  },
  render: () => null,
});

describe("a Block offering one of the Theme's colours", () => {
  it("accepts the tokens it declared", () => {
    for (const colour of ["accent", "primary", "accentText"]) {
      expect(badge.propsSchema.parse({ text: "New", colour }).colour).toBe(colour);
    }
  });

  it("refuses a colour, which is the entire point", () => {
    // Every one of these is a perfectly good CSS colour and none of them is a Theme token.
    for (const attempt of ["#ff0000", "red", "rgb(255 0 0)", "var(--mn-color-primary)"]) {
      expect(() => badge.propsSchema.parse({ text: "New", colour: attempt })).toThrow();
    }
  });

  it("refuses a Theme token this Block did not offer", () => {
    // `muted` is a real token. The Block Type narrows the list to what reads at its size, so
    // the schema is per-Block rather than per-Theme.
    expect(COLOR_TOKENS).toContain("muted");
    expect(() => badge.propsSchema.parse({ text: "New", colour: "muted" })).toThrow();
  });

  it("gives a Block written before the field existed the colour it already had", () => {
    // The rule the first declared variant follows, for the same reason: a field that
    // repaints every Site the day it lands is a field nobody adds.
    expect(badge.propsSchema.parse({ text: "New" }).colour).toBe("accent");
  });

  it("tells the Editor which choices to draw", () => {
    // The Editor generates this control the way it generates every other one, from the
    // declaration — there is no second, hand-written list of colours anywhere.
    expect(badge.fields.colour.kind).toBe("token");
    expect(badge.fields.colour.options).toEqual(["accent", "primary", "accentText"]);
  });

  it("only names tokens the Theme actually emits", () => {
    // The swatch and the stylesheet both spell these as custom properties, so a token here
    // that the Theme does not carry is a colour that silently resolves to nothing.
    for (const token of badge.fields.colour.options ?? []) {
      expect(COLOR_TOKENS).toContain(token);
    }
  });
});
