/**
 * What survives editing a Theme in the Dashboard.
 *
 * The Design page posts the whole form back and `saveTheme` replaces the stored Theme with
 * it, so this object is not a view of a Theme -- it is the Theme, and anything it does not
 * carry is deleted the first time somebody moves a colour. That failed silently once already:
 * `texture` was missing while `radius`, `border` and `surface` were carried for precisely
 * that reason, so the Starter's own grain came off the Site with no error and nothing in a
 * log. Adding a family to `Theme` and forgetting this file is the way it happens again, which
 * is what the first test is for.
 */

import { completeTheme, defineTheme } from "@mimnets/core";
import { describe, expect, it } from "vitest";

import { DERIVED_FAMILIES, editableTheme } from "./editable-theme";
import { theme as starterTheme } from "../../../theme";

/** A Theme that states something unusual in every family, so a dropped one is visible. */
const stated = defineTheme({
  colors: { primary: "#2f6f62", accent: "#c2582c", background: "#fbfaf7", text: "#1b1b1b" },
  radius: { base: "2px" },
  border: { base: "3px" },
  surface: "raised",
  texture: "grain",
  spacing: { section: "5rem", gutter: "1.5rem" },
  measure: "64rem",
});

describe("the Theme the Dashboard hands to its form", () => {
  it("carries every family a Theme states, except the ones it derives", () => {
    // The guard against the next `texture`. A family added to Theme and not to
    // `editableTheme` turns this red rather than turning itself off on somebody's Site.
    const carried = new Set(Object.keys(editableTheme(stated)));
    const derived = new Set<string>(DERIVED_FAMILIES);

    for (const family of Object.keys(stated)) {
      expect(
        carried.has(family) || derived.has(family),
        `\`${family}\` is neither carried by the form nor declared derived, so editing a ` +
          `colour in the Dashboard will delete it from the Site`,
      ).toBe(true);
    }
  });

  it("does not send back what the Theme derives for itself", () => {
    const carried = editableTheme(stated) as unknown as Record<string, unknown>;

    for (const family of DERIVED_FAMILIES) {
      expect(carried[family]).toBeUndefined();
    }
  });

  it("keeps the value of every family it carries", () => {
    const carried = editableTheme(stated);

    expect(carried.surface).toBe("raised");
    expect(carried.texture).toBe("grain");
    expect(carried.radius.base).toBe("2px");
    expect(carried.border.base).toBe("3px");
    expect(carried.measure).toBe("64rem");
    expect(carried.spacing).toEqual({ section: "5rem", gutter: "1.5rem" });
  });

  it("survives the round trip the Dashboard actually performs", () => {
    // What pressing Save does: post this object, complete it, store it. The Starter is the
    // fixture because it is the Site that lost its grain, and it states both of the two
    // families that have no control on the form.
    const posted = editableTheme(starterTheme) as Parameters<typeof completeTheme>[0];
    const saved = completeTheme(posted);

    expect(saved.texture).toBe(starterTheme.texture);
    expect(saved.surface).toBe(starterTheme.surface);
    expect(saved.radius).toEqual(starterTheme.radius);
    expect(saved.border).toEqual(starterTheme.border);
    expect(saved.measure).toBe(starterTheme.measure);
  });
});
