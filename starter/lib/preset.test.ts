import "dotenv/config";

import { describe, expect, it } from "vitest";
import { generatePreset, PRESET_DIRECTIONS } from "@mimnets/core/ai";

import { registry } from "../blocks.config";
import { aiProvider } from "./ai";

/**
 * Generating a Preset against a real model and this Site's real Block library.
 *
 * The unit tests in core prove that invalid output is rejected. That is only half the
 * feature: a generator that is rejected every time is correct and useless. This proves the
 * other half — that a free model, told about the registry, actually produces something that
 * passes.
 *
 * It is the test most likely to catch a bad prompt, because nothing else can. Skipped when
 * no provider is configured.
 */
const provider = aiProvider();
const suite = provider ? describe : describe.skip;

suite("generating a Preset for real", () => {
  it(
    "produces a valid Site from a one-line brief",
    async () => {
      const preset = await generatePreset(provider!, {
        brief: "A family law firm in Leeds, established 1994. Calm and trustworthy.",
        registry,
      });

      expect(preset.name.length).toBeGreaterThan(0);
      expect(preset.pages.length).toBeGreaterThan(0);

      // A home page is the one thing every Site needs.
      expect(preset.pages.some((page) => page.path === "/")).toBe(true);

      const home = preset.pages.find((page) => page.path === "/")!;
      expect(home.layout.slots.main.length).toBeGreaterThanOrEqual(3);

      // Real copy, not placeholders. This is the failure that looks like success.
      const text = JSON.stringify(home.layout);
      expect(text.toLowerCase()).not.toContain("lorem ipsum");
      expect(text).not.toMatch(/\[[A-Z ]{3,}\]/);
    },
    180_000,
  );

  it(
    "only ever uses Blocks this Site registers",
    async () => {
      // Guaranteed by the schema, so this is really checking that the guarantee is reached
      // rather than skipped — and that the described registry matches the real one.
      const preset = await generatePreset(provider!, {
        brief: "A skate shop in Bristol. Loud, young, second-hand boards.",
        registry,
        direction: PRESET_DIRECTIONS[2],
      });

      const known = new Set(registry.blocks.map((block) => block.name));
      for (const page of preset.pages) {
        for (const section of page.layout.slots.main) {
          for (const column of section.columns) {
            for (const block of column.blocks) {
              expect(known.has(block.type)).toBe(true);
            }
          }
        }
      }
    },
    180_000,
  );

  it(
    "gives two different businesses two different designs",
    async () => {
      // The exit criterion in the roadmap, stated as a test: "law firm" and "skate shop"
      // should produce two Sites nobody would guess share a codebase.
      const [firm, shop] = await Promise.all([
        generatePreset(provider!, {
          brief: "A family law firm in Leeds. Calm, trustworthy, traditional.",
          registry,
          direction: PRESET_DIRECTIONS[0],
        }),
        generatePreset(provider!, {
          brief: "A skate shop in Bristol. Loud, young, second-hand boards.",
          registry,
          direction: PRESET_DIRECTIONS[2],
        }),
      ]);

      // Not the page titles — a home page is called "Home" for both, correctly. What the
      // roadmap actually asks is that the two Sites do not look related.
      expect(firm.theme.colors.primary).not.toBe(shop.theme.colors.primary);
      expect(firm.theme.colors.background).not.toBe(shop.theme.colors.background);

      const firmCopy = JSON.stringify(firm.pages).toLowerCase();
      const shopCopy = JSON.stringify(shop.pages).toLowerCase();
      expect(firmCopy).not.toBe(shopCopy);

      // And each is written about its own business rather than filled with generic copy.
      expect(firmCopy).toMatch(/law|legal|solicitor|famil/);
      expect(shopCopy).toMatch(/skate|board|deck|bristol/);
    },
    240_000,
  );
});
