"use client";

import { paletteFromPixels, type PaletteColors } from "@mimnets/core";

/**
 * Reads an uploaded image in the browser: its pixels, and a version small enough to send.
 *
 * The decoding happens here rather than on the server for one plain reason — the browser
 * already has a decoder for every format a person might drop in, and the server would need
 * a dependency for each. A canvas gives exact pixels for free.
 *
 * It also means the full-resolution file never leaves the machine. What goes to the model is
 * a downscaled copy, which is all a model can use anyway.
 */

export interface ReadImageResult {
  /** Colours from the actual pixels — exact, and not a model's description of them. */
  palette: PaletteColors;
  /** A downscaled data URL to send to a vision model. */
  dataUrl: string;
  width: number;
  height: number;
}

/** Wide enough for a model to read a layout, small enough not to be a huge upload. */
const SEND_WIDTH = 900;

/** The palette needs colour proportions, not detail; this is plenty and it is fast. */
const SAMPLE_WIDTH = 160;

export async function readImageForDesign(file: File): Promise<ReadImageResult> {
  const bitmap = await createImageBitmap(file);

  try {
    const palette = paletteFromPixels(pixelsOf(bitmap, SAMPLE_WIDTH));

    // JPEG rather than PNG: a screenshot as a PNG data URL is easily several megabytes, and
    // the difference is invisible to a model reading a layout.
    const scale = Math.min(1, SEND_WIDTH / bitmap.width);
    const canvas = draw(bitmap, Math.round(bitmap.width * scale), Math.round(bitmap.height * scale));
    const dataUrl = canvas.toDataURL("image/jpeg", 0.82);

    return { palette, dataUrl, width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}

function draw(bitmap: ImageBitmap, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("This browser would not give us a canvas to read the image with.");

  // White underneath, so a transparent PNG reports the colours it is designed to sit on
  // rather than counting transparency as black.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);

  return canvas;
}

function pixelsOf(bitmap: ImageBitmap, width: number): Uint8ClampedArray {
  const height = Math.max(1, Math.round((bitmap.height / bitmap.width) * width));
  const canvas = draw(bitmap, Math.min(width, bitmap.width), height);
  const context = canvas.getContext("2d")!;
  return context.getImageData(0, 0, canvas.width, canvas.height).data;
}
