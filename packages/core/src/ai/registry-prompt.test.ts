/**
 * What a generator is told about a Site's Block Types.
 *
 * The prompt is generated from the registry rather than written out for one reason: a
 * hand-maintained copy goes wrong silently. The output still validates, it just never uses
 * the thing nobody described. That happened here. A button's colour was a `field.select`, so
 * it was described automatically and a model could choose "accent"; when it became a variant
 * it left `fields`, and nothing added it back to the prompt. Generation did not fail -- it
 * quietly stopped making the choice, and every generated button came back primary.
 *
 * These tests read the prompt for the shape a model needs in order to make that choice at
 * all: the looks, where to put one, and a section shape with somewhere to put it.
 */

import { describe, expect, it } from "vitest";

import { defineBlock } from "../blocks/define";
import { field } from "../blocks/fields";
import { createRegistry } from "../blocks/registry";
import { describeComposition, describeLayoutRules, describeRegistry } from "./registry-prompt";

const registry = createRegistry([
  defineBlock({
    name: "button",
    label: "Button",
    variants: ["primary", "accent", "outline"],
    variantWasField: "style",
    fields: { label: field.text({ label: "Label", default: "Learn more" }) },
    render: () => null,
  }),
  defineBlock({
    name: "plain",
    label: "Plain",
    fields: { note: field.text({ label: "Note", default: "" }) },
    render: () => null,
  }),
]);

describe("describing the Block Types", () => {
  it("names every look a Block Type declares", () => {
    const prompt = describeRegistry(registry);

    for (const variant of ["primary", "accent", "outline"]) {
      expect(prompt).toContain(`"${variant}"`);
    }
  });

  it("says where a look goes, not just that it exists", () => {
    // A list of words the model cannot place is worse than no list: it invents a key.
    expect(describeRegistry(registry)).toContain('"style": { "variant"');
  });

  it("says nothing about looks for a Block Type that declares none", () => {
    const plain = describeRegistry(createRegistry([registry.get("plain")!]));

    expect(plain).not.toContain("looks:");
  });
});

describe("describing the shape a page is written in", () => {
  it("gives a block somewhere to carry its look", () => {
    // Without `style` in the emitted shape there is nowhere to put a variant, and describing
    // the looks above would be describing a choice the model cannot express.
    expect(describeLayoutRules()).toContain('"style"');
  });

  it("still names the enforced structural rules", () => {
    const rules = describeLayoutRules();

    expect(rules).toContain("Blocks never contain other blocks.");
    expect(rules).toContain("Do not invent ids.");
  });
});

describe("describing composition", () => {
  it("mentions the mesh band, which the tone enum offers", () => {
    // `describeLayoutRules` lists it in the tone enum, so a generator can already emit it.
    // Composition advice that stops at the four older tones means it never will.
    expect(describeComposition()).toContain("mesh");
  });
});
