import { readableOn } from "./index";

/**
 * A Theme's colours, read from the pixels of an image.
 *
 * Deliberately not a job for the model. A vision model *describes* colour — it will call
 * something "a deep forest green" and then produce a hex value that is approximately that,
 * and these are the same models that drop whole keys out of an object. The pixels are right
 * there and counting them is exact, free, and cannot fail in the ways a model can.
 *
 * The model's job is the part pixels cannot answer: what the page is arranged like.
 *
 * This works on a raw RGBA array so it can be tested without an image decoder. The browser
 * supplies the pixels via a canvas, which is also why nothing here needs a dependency.
 */

export interface PaletteColors {
  background: string;
  surface: string;
  text: string;
  muted: string;
  primary: string;
  onPrimary: string;
  accent: string;
  onAccent: string;
  border: string;
}

interface Swatch {
  r: number;
  g: number;
  b: number;
  count: number;
}

const hex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;

/** Perceived lightness, 0 to 1. The same weighting the contrast helper uses. */
function lightness({ r, g, b }: Swatch): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** 0 for grey, 1 for a pure hue. */
function saturation({ r, g, b }: Swatch): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

function hue({ r, g, b }: Swatch): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;

  const d = max - min;
  const h =
    max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return ((h * 60) + 360) % 360;
}

function mix(a: Swatch, b: Swatch, amount: number): string {
  return hex(
    a.r + (b.r - a.r) * amount,
    a.g + (b.g - a.g) * amount,
    a.b + (b.b - a.b) * amount,
  );
}

/**
 * Buckets colours so near-identical pixels count as one.
 *
 * A photograph of a wall is thousands of slightly different beiges; without bucketing, every
 * one of them is its own "colour" and nothing is ever dominant. 24 levels per channel is
 * coarse enough to group a gradient and fine enough to keep two brand colours apart.
 */
function collect(pixels: Uint8ClampedArray | number[], step = 24): Swatch[] {
  const buckets = new Map<string, Swatch>();

  for (let i = 0; i + 3 < pixels.length; i += 4) {
    // Anything meaningfully transparent is not a colour anybody sees.
    if ((pixels[i + 3] ?? 255) < 200) continue;

    const r = pixels[i]!;
    const g = pixels[i + 1]!;
    const b = pixels[i + 2]!;

    const key = `${Math.round(r / step)}|${Math.round(g / step)}|${Math.round(b / step)}`;
    const existing = buckets.get(key);

    if (existing) {
      // Averaged rather than snapped to the bucket centre, so the result is a colour that
      // was actually in the image.
      const n = existing.count + 1;
      existing.r += (r - existing.r) / n;
      existing.g += (g - existing.g) / n;
      existing.b += (b - existing.b) / n;
      existing.count = n;
    } else {
      buckets.set(key, { r, g, b, count: 1 });
    }
  }

  return [...buckets.values()].sort((a, b) => b.count - a.count);
}

/**
 * Turns an image into a full palette.
 *
 * The rules are deliberately blunt, because a clever rule that is wrong on one image in five
 * is worse than a plain one that is always defensible:
 *
 * - **background** is the most common colour. On almost every design that is the page.
 * - **text** is the frequent colour furthest from the background in lightness.
 * - **primary** is the most saturated colour with enough presence to be a choice rather than
 *   a stray pixel — the brand colour, in other words.
 * - **accent** is the most saturated colour whose hue is far enough from primary to read as
 *   a second colour rather than a shade of the first.
 */
export function paletteFromPixels(pixels: Uint8ClampedArray | number[]): PaletteColors {
  const swatches = collect(pixels);

  if (swatches.length === 0) {
    // An empty or fully transparent image. Grey is honest; guessing is not.
    return {
      background: "#ffffff",
      surface: "#f4f4f6",
      text: "#16161a",
      muted: "#6b6b78",
      primary: "#3b6cf6",
      onPrimary: "#ffffff",
      accent: "#f0568c",
      onAccent: "#ffffff",
      border: "#e4e4e9",
    };
  }

  const total = swatches.reduce((sum, s) => sum + s.count, 0);
  const background = swatches[0]!;
  const backgroundLightness = lightness(background);

  // Furthest from the background in lightness, among colours that actually appear.
  const text =
    [...swatches]
      .filter((s) => s.count / total > 0.005)
      .sort((a, b) => Math.abs(lightness(b) - backgroundLightness) - Math.abs(lightness(a) - backgroundLightness))[0] ??
    ({ r: 20, g: 20, b: 24, count: 1 } as Swatch);

  // Present enough to be a decision. A single saturated pixel is a JPEG artefact.
  const candidates = swatches.filter((s) => s.count / total > 0.004 && saturation(s) > 0.25);

  const primary =
    [...candidates].sort((a, b) => saturation(b) * Math.log1p(b.count) - saturation(a) * Math.log1p(a.count))[0] ??
    ({ r: 59, g: 108, b: 246, count: 1 } as Swatch);

  const primaryHue = hue(primary);
  const accent =
    candidates
      .filter((s) => {
        const distance = Math.abs(hue(s) - primaryHue);
        // A colour within 40° of primary is a shade of it, not a second colour.
        return Math.min(distance, 360 - distance) > 40;
      })
      .sort((a, b) => saturation(b) * Math.log1p(b.count) - saturation(a) * Math.log1p(a.count))[0] ?? primary;

  const backgroundHex = hex(background.r, background.g, background.b);
  const textHex = hex(text.r, text.g, text.b);
  const primaryHex = hex(primary.r, primary.g, primary.b);
  const accentHex = hex(accent.r, accent.g, accent.b);

  return {
    background: backgroundHex,
    // Derived rather than sampled: a "surface" is a slight step off the page, and images
    // rarely contain one that reads as such on its own.
    surface: mix(background, text, 0.06),
    text: textHex,
    muted: mix(text, background, 0.42),
    primary: primaryHex,
    onPrimary: readableOn(primaryHex),
    accent: accentHex,
    onAccent: readableOn(accentHex),
    border: mix(background, text, 0.14),
  };
}
