import { describe, expect, it } from "vitest";

import { createRegistry } from "../blocks/registry";
import { defineBlock } from "../blocks/define";
import { field } from "../blocks/fields";
import { extractJson, generatePreset } from "./preset";
import { readableOn } from "../theme/index";
import { describeRegistry } from "./registry-prompt";
import type { AiProvider } from "./provider";

/**
 * Preset generation, with the model replaced by a script.
 *
 * What is being tested is the validation boundary, not the model: a Preset is the first
 * thing in this product built out of untrusted output (ADR-0007), and the guarantee is that
 * invalid output is rejected rather than stored. That guarantee has to hold for output
 * nobody can arrange to receive on demand, which is why the provider here is a fake.
 */

const heading = defineBlock({
  name: "heading",
  label: "Heading",
  fields: {
    text: field.text({ default: "" }),
    level: field.select({ options: ["h1", "h2", "h3"], default: "h2" }),
  },
  render: () => null,
});

const text = defineBlock({
  name: "text",
  label: "Text",
  fields: { body: field.textarea({ default: "" }) },
  render: () => null,
});

const registry = createRegistry([heading, text]);

/** Replies with whatever it is given, in order, one reply per attempt. */
function scripted(...replies: string[]): AiProvider {
  let index = 0;
  return {
    name: "scripted",
    model: "scripted",
    free: true,
    async *stream() {
      yield replies[Math.min(index++, replies.length - 1)]!;
    },
  };
}

const THEME = {
  colors: {
    background: "#ffffff",
    surface: "#f2f4f8",
    text: "#101418",
    muted: "#5a6b80",
    primary: "#1f6f4a",
    onPrimary: "#ffffff",
    accent: "#d2603a",
    onAccent: "#ffffff",
    border: "#dfe4ea",
  },
  fonts: { body: "Georgia, serif", heading: "Georgia, serif" },
  radius: { base: "8px" },
  spacing: { section: "4rem", gutter: "2rem" },
  measure: "72rem",
};

function preset(sections: unknown[]) {
  return {
    name: "Quiet",
    description: "A calm, editorial direction.",
    theme: THEME,
    pages: [{ title: "Home", path: "/", sections }],
  };
}

const goodSection = {
  layout: "1",
  tone: "default",
  padding: "large",
  columns: [
    {
      blocks: [
        { type: "heading", props: { text: "We fix bikes", level: "h1" } },
        { type: "text", props: { body: "Since 1994." } },
      ],
    },
  ],
};

// Counting per prefix rather than randomising, so the assertions can be exact.
let counters: Record<string, number> = {};
const newId = (prefix: string) => {
  counters[prefix] = (counters[prefix] ?? 0) + 1;
  return `${prefix}-${counters[prefix]}`;
};

describe("pulling JSON out of a reply", () => {
  it("reads a bare object", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("reads it out of a markdown fence", () => {
    // Models do this no matter how firmly they are told not to, and throwing away an
    // otherwise valid design over it would be a bad trade.
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("reads it past a preamble", () => {
    expect(extractJson('Here you go:\n\n{"a":1}\n\nHope that helps!')).toEqual({ a: 1 });
  });

  it("refuses a reply with no object in it", () => {
    expect(() => extractJson("I am unable to help with that.")).toThrow(/no JSON object/);
  });
});

describe("describing the registry to a model", () => {
  it("names every registered Block and its fields", () => {
    const described = describeRegistry(registry);
    expect(described).toContain("heading — Heading");
    expect(described).toContain("text — Text");
    expect(described).toContain('one of "h1" | "h2" | "h3"');
  });

  it("is built from the registry, so a new Block appears without anyone updating a list", () => {
    const extra = defineBlock({
      name: "quote",
      label: "Quote",
      fields: { body: field.text({ default: "" }) },
      render: () => null,
    });
    expect(describeRegistry(createRegistry([heading, extra]))).toContain("quote — Quote");
  });
});

describe("generating a Preset", () => {
  it("returns a validated layout for good output", async () => {
    counters = {};
    const result = await generatePreset(scripted(JSON.stringify(preset([goodSection]))), {
      brief: "a bike shop",
      registry,
      newId,
    });

    expect(result.name).toBe("Quiet");
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0]!.layout.slots.main[0]!.columns[0]!.blocks).toHaveLength(2);
  });

  it("assigns the ids itself", async () => {
    counters = {};
    const result = await generatePreset(scripted(JSON.stringify(preset([goodSection]))), {
      brief: "a bike shop",
      registry,
      newId,
    });

    const section = result.pages[0]!.layout.slots.main[0]!;
    // A model asked for unique ids produces duplicates, and the Editor addresses Blocks by id.
    expect(section.id).toBe("sec-1");
    expect(section.columns[0]!.id).toBe("col-1");
    expect(section.columns[0]!.blocks[0]!.id).toBe("blk-1");
    expect(section.columns[0]!.blocks[1]!.id).toBe("blk-2");
  });

  it("rejects a Block Type this Site does not register", async () => {
    // The guarantee the whole feature rests on: a model cannot invent a Block.
    const invented = {
      ...goodSection,
      columns: [{ blocks: [{ type: "carousel", props: { slides: [] } }] }],
    };

    await expect(
      generatePreset(scripted(JSON.stringify(preset([invented]))), {
        brief: "a bike shop",
        registry,
        newId,
      }),
    ).rejects.toThrow(/not valid after two attempts/);
  });

  it("rejects a column count that does not match the layout", async () => {
    const mismatched = { ...goodSection, layout: "1-1", columns: [{ blocks: [] }] };

    await expect(
      generatePreset(scripted(JSON.stringify(preset([mismatched]))), {
        brief: "a bike shop",
        registry,
        newId,
      }),
    ).rejects.toThrow(/not valid after two attempts/);
  });

  it("fills in the contrast colours the model is not asked for", async () => {
    counters = {};
    const withoutContrast = preset([goodSection]);
    // @ts-expect-error deliberately omitting what the schema now treats as optional
    delete withoutContrast.theme.colors.onPrimary;
    // @ts-expect-error same
    delete withoutContrast.theme.colors.onAccent;

    const result = await generatePreset(scripted(JSON.stringify(withoutContrast)), {
      brief: "x",
      registry,
      newId,
    });

    // Asking a model to work out contrast is asking for unreadable text; luminance decides.
    expect(result.theme.colors.onPrimary).toBe(readableOn(THEME.colors.primary));
    expect(result.theme.colors.onAccent).toBe(readableOn(THEME.colors.accent));
  });

  it("rejects a colour that is not a colour", async () => {
    // A Theme is compiled straight into CSS custom properties, so this is a way to write
    // arbitrary CSS into every Page if it is not constrained.
    const bad = preset([goodSection]);
    bad.theme = { ...THEME, colors: { ...THEME.colors, primary: "red; } body { display:none" } };

    await expect(
      generatePreset(scripted(JSON.stringify(bad)), { brief: "x", registry, newId }),
    ).rejects.toThrow(/not valid after two attempts/);
  });

  it("retries once, and succeeds when the second attempt is right", async () => {
    counters = {};
    const broken = JSON.stringify(preset([{ ...goodSection, layout: "9-9" }]));
    const fixed = JSON.stringify(preset([goodSection]));

    const result = await generatePreset(scripted(broken, fixed), {
      brief: "a bike shop",
      registry,
      newId,
    });

    expect(result.pages[0]!.layout.slots.main).toHaveLength(1);
  });

  it("gives up after the second attempt rather than patching the output", async () => {
    // Silently repairing model output would mean nobody ever learns the prompt is wrong.
    const broken = JSON.stringify(preset([{ ...goodSection, layout: "9-9" }]));

    await expect(
      generatePreset(scripted(broken, broken), { brief: "x", registry, newId }),
    ).rejects.toThrow(/not valid after two attempts/);
  });

  it("refuses a path that is not a path", async () => {
    const bad = preset([goodSection]);
    bad.pages[0]!.path = "https://elsewhere.example/take-over";

    await expect(
      generatePreset(scripted(JSON.stringify(bad)), { brief: "x", registry, newId }),
    ).rejects.toThrow(/not valid after two attempts/);
  });
});
