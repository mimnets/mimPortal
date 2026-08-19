import { describe, expect, it } from "vitest";

import { imageDimensions } from "./dimensions";

/**
 * The fixtures are real files, encoded by a browser at a known size, not headers written by
 * hand to match the parser. A parser tested against its own assumptions proves nothing.
 *
 * Each is a 40x25 canvas painted with two rectangles, exported by Chrome.
 */
const PNG_40x25 =
  "iVBORw0KGgoAAAANSUhEUgAAACgAAAAZCAYAAABD2GxlAAAAZUlEQVR4AezS0QnAMAiEYZuV2lU6S2bIbtnJrHDwQ1C4gG8e" +
  "xE/H+2dWrhHFnz9IF9RTcM8nlKI6Sr6noDLZrR4LUmkLWpAK0HzPG/xWhlJUR8n3FFQmu9VjQSptQQtSAZovf4MHAAD//zlG" +
  "DREAAAAGSURBVAMArpeDI1FDEdcAAAAASUVORK5CYII=";

const JPEG_40x25 =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAA" +
  "AABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAA" +
  "ABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAA" +
  "AAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAA" +
  "AAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAA" +
  "AABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAMCAgMC" +
  "AgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkF" +
  "BQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAAZACgDASIAAhEB" +
  "AxEB/8QAFwABAQEBAAAAAAAAAAAAAAAAAAYHCP/EACMQAAEEAwABBAMAAAAAAAAAAAEAAgMEBQYRBwgSE1EhQWH/xAAYAQEA" +
  "AwEAAAAAAAAAAAAAAAAAAwYHCP/EACQRAAEBBgYDAAAAAAAAAAAAAAAFAQIDBAYRBxITISIxMkLw/9oADAMBAAIRAxEAPwCL" +
  "8f8Aj/I+SMzNjMZNVgnirusudbe5rS0Oa3g9rXHvXj9fas836atnwOGv5OxfxL4KVeSzI2OaUuLWNLiB2MDvB9hPTVm8dgd6" +
  "v2Mnfq46B2NkjbLbmbE0u+WI+0FxA7wE8/hW779v2sXNF2OvX2PEzzy42zHHFHeic57jE4BoAd0kn8cVgxHxHrin64hIqLCz" +
  "Sj2lduk17yby5fWIEVFS5xLemZl60Rmb2t11scXIiLtMzMIiIAiIgCIiAIiID//Z";

const WEBP_40x25 =
  "UklGRtYCAABXRUJQVlA4WAoAAAAgAAAAJwAAGAAASUNDUMgBAAAAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAA" +
  "AABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAA" +
  "ABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAA" +
  "AAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAA" +
  "AAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAA" +
  "AABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADZWUDgg6AAAAPAH" +
  "AJ0BKigAGQA+MRiKQ6IhoRK0ACADBLYAQaYi3yv8AP2Z4wLsB+wF6AXJL+gG+gcAB0ov7D/rB7WJGgH8r6gATCJMhhSX4AD+" +
  "9Bv/7ZPT3NfuUtwv10wtby/YzP34Yx70Xj+1Tyo13O6nG4frWF1FZb6OiH7itguJlBv5E///fyf1P6FUSrGNUZ9s//XQdWNM" +
  "xcFCb//roBizqbnUj5VN/hftvpOf6XNZp1H///DXTM9uLd7Qf2ecTJqvzu+pp4MWWIEm9vEIS32X3ai7kW/+hfo/kehHNq54" +
  "D1DF2Yqxdc+hgAAAAAA=";

/** The 43-byte transparent GIF that has been on the web since 1995. */
const GIF_1x1 = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

const decode = (base64: string) => new Uint8Array(Buffer.from(base64, "base64"));

describe("reading an image size from its header", () => {
  it("reads a PNG", () => {
    expect(imageDimensions(decode(PNG_40x25))).toEqual({ width: 40, height: 25 });
  });

  it("reads a JPEG", () => {
    expect(imageDimensions(decode(JPEG_40x25))).toEqual({ width: 40, height: 25 });
  });

  it("reads a WebP", () => {
    expect(imageDimensions(decode(WEBP_40x25))).toEqual({ width: 40, height: 25 });
  });

  it("reads a GIF", () => {
    expect(imageDimensions(decode(GIF_1x1))).toEqual({ width: 1, height: 1 });
  });

  it("reads only the header, not the whole file", () => {
    // The renderer must not depend on holding a 8MB upload in memory to learn two numbers.
    const png = decode(PNG_40x25);
    expect(imageDimensions(png.subarray(0, 24))).toEqual({ width: 40, height: 25 });
  });

  it("returns null rather than guessing at a format it does not know", () => {
    expect(imageDimensions(new TextEncoder().encode("<svg viewBox=\"0 0 40 25\"/>"))).toBeNull();
    expect(imageDimensions(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]))).toBeNull();
    expect(imageDimensions(new Uint8Array())).toBeNull();
  });

  it("returns null for a truncated file instead of a nonsense size", () => {
    // A half-uploaded image is a missing attribute, never a 0x0 one.
    expect(imageDimensions(decode(JPEG_40x25).subarray(0, 4))).toBeNull();
  });
});
