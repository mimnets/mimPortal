import { describe, expect, it } from "vitest";
import { completeTheme, themeSchema } from "@mimnets/core";

import { registry } from "../blocks.config";
import { BUILT_IN_PRESETS } from "./index";

/**
 * The built-in designs, validated against this Site's real registry.
 *
 * These ship with the Starter, so a broken one is not a bad afternoon for whoever generated
 * it — it is a bug in the product, hit by a client on their first click. They go through
 * exactly the same schemas an AI-generated Preset does, which is the point: the validation
 * boundary is not "code we trust and output we do not", it is everything.
 */

const id = (prefix: string) => `${prefix}-test`;

/** Mirrors what the apply action does: ids are assigned, then the whole thing is parsed. */
function withIds(sections: unknown[]): unknown[] {
  return sections.map((section) => {
    const node = section as { columns?: { blocks?: unknown[] }[] };
    return {
      ...(section as object),
      id: id("sec"),
      columns: (node.columns ?? []).map((column) => ({
        ...column,
        id: id("col"),
        blocks: (column.blocks ?? []).map((block) => ({ ...(block as object), id: id("blk") })),
      })),
    };
  });
}

describe("the built-in designs", () => {
  it("ships more than one, so there is a choice", () => {
    expect(BUILT_IN_PRESETS.length).toBeGreaterThanOrEqual(3);
  });

  it("gives every design a unique slug", () => {
    const slugs = BUILT_IN_PRESETS.map((preset) => preset.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it.each(BUILT_IN_PRESETS.map((preset) => [preset.name, preset] as const))(
    "%s has a valid Theme",
    (_name, preset) => {
      const parsed = themeSchema.safeParse(preset.theme);
      expect(parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.issues)).toBe(true);

      // Contrast is derived, so a design cannot ship with unreadable text on its own band.
      const complete = completeTheme(preset.theme);
      expect(["#111111", "#ffffff"]).toContain(complete.colors.onPrimary);
    },
  );

  it.each(BUILT_IN_PRESETS.map((preset) => [preset.name, preset] as const))(
    "%s only uses Blocks this Site registers",
    (_name, preset) => {
      const known = new Set(registry.blocks.map((block) => block.name));

      for (const page of preset.pages) {
        // The real check: parseLayout throws on an unknown Block Type, a column count that
        // does not match its layout, or a missing prop.
        const layout = registry.parseLayout({
          version: 1,
          slots: { header: [], main: withIds(page.sections), sidebar: [], footer: [] },
        });

        for (const section of layout.slots.main) {
          for (const column of section.columns) {
            for (const block of column.blocks) {
              expect(known.has(block.type)).toBe(true);
            }
          }
        }
      }
    },
  );

  it.each(BUILT_IN_PRESETS.map((preset) => [preset.name, preset] as const))(
    "%s has a home page and real copy on it",
    (_name, preset) => {
      const home = preset.pages.find((page) => page.path === "/");
      expect(home).toBeDefined();
      expect(home!.sections.length).toBeGreaterThanOrEqual(4);

      const copy = JSON.stringify(home);
      expect(copy.toLowerCase()).not.toContain("lorem ipsum");
      // Placeholders in a shipped design are worse than in a generated one: nobody expects
      // to have to proofread the thing they chose from a gallery.
      expect(copy).not.toMatch(/\[[A-Z ]{3,}\]/);
      expect(copy).not.toContain("TODO");
    },
  );

  it.each(BUILT_IN_PRESETS.map((preset) => [preset.name, preset] as const))(
    "%s alternates its Section tones rather than running flat",
    (_name, preset) => {
      const home = preset.pages.find((page) => page.path === "/")!;
      const tones = new Set(home.sections.map((s) => (s as { tone?: string }).tone));
      // A page where every band is the same tone reads as a document, which is the whole
      // argument for Sections carrying paint (ADR-0013).
      expect(tones.size).toBeGreaterThanOrEqual(3);
    },
  );

  it.each(BUILT_IN_PRESETS.map((preset) => [preset.name, preset] as const))(
    "%s keeps the button colours its author wrote",
    (_name, preset) => {
      /**
       * These designs still describe a button's colour the way every stored Page does, as
       * `props.style`, so all three depend on the lift in `registry.ts` to reach the variant
       * the renderer reads. Disabling that lift used to leave this whole file green: the
       * check above only asks whether the Block Type is registered, and an accent button
       * silently becoming a primary one is still a registered button.
       *
       * Until the presets are rewritten to state `style.variant` directly -- which is what
       * lets `variantWasField` be deleted -- this is the assertion standing between a shipped
       * design and every call to action in it changing colour.
       */
      let checked = 0;

      for (const page of preset.pages) {
        const layout = registry.parseLayout({
          version: 1,
          slots: { header: [], main: withIds(page.sections), sidebar: [], footer: [] },
        });

        for (const section of layout.slots.main) {
          for (const column of section.columns) {
            for (const block of column.blocks) {
              if (block.type !== "button") continue;

              type Written = {
                type?: string;
                props?: Record<string, unknown>;
                style?: Record<string, unknown>;
              };
              const source = page.sections.flatMap((s) =>
                ((s as { columns?: { blocks?: Written[] }[] }).columns ?? []).flatMap(
                  (c) => c.blocks ?? [],
                ),
              );
              const written = source.find(
                (b) => b.type === "button" && b.props?.label === block.props.label,
              );

              // Read either shape on purpose. These designs state `style.variant` now, but
              // the assertion that matters is "the colour the author wrote is the colour that
              // survives parsing", and that has to keep holding for a design still written
              // the old way -- which is every design any Site has stored.
              const wanted =
                (written?.style?.variant as string | undefined) ??
                (written?.props?.style as string | undefined) ??
                "primary";

              expect(block.style.variant).toBe(wanted);
              checked += 1;
            }
          }
        }
      }

      // A design with no buttons would pass every assertion above by having none to fail.
      expect(checked).toBeGreaterThan(0);
    },
  );

  it("gives each design a different palette", () => {
    const primaries = BUILT_IN_PRESETS.map((preset) => preset.theme.colors.primary);
    expect(new Set(primaries).size).toBe(primaries.length);
  });
});
