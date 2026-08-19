/**
 * An image's pixel size, read from the first few bytes of the file.
 *
 * The renderer needs width and height to reserve the right space before the image arrives;
 * without them every image on a Page shifts the text under it as it loads. Decoding the
 * whole image to learn two numbers would mean a native dependency on every Site, so this
 * reads the handful of header bytes each format puts them in.
 *
 * Returns null for anything it does not recognise — an unknown size is a missing attribute,
 * never a failed upload.
 */

export interface Dimensions {
  width: number;
  height: number;
}

function u16be(b: Uint8Array, i: number): number {
  return ((b[i] ?? 0) << 8) | (b[i + 1] ?? 0);
}
function u16le(b: Uint8Array, i: number): number {
  return (b[i] ?? 0) | ((b[i + 1] ?? 0) << 8);
}
function u32be(b: Uint8Array, i: number): number {
  return (((b[i] ?? 0) << 24) >>> 0) + ((b[i + 1] ?? 0) << 16) + ((b[i + 2] ?? 0) << 8) + (b[i + 3] ?? 0);
}
function u24le(b: Uint8Array, i: number): number {
  return (b[i] ?? 0) | ((b[i + 1] ?? 0) << 8) | ((b[i + 2] ?? 0) << 16);
}
function ascii(b: Uint8Array, i: number, length: number): string {
  return String.fromCharCode(...b.subarray(i, i + length));
}

function png(b: Uint8Array): Dimensions | null {
  // \x89PNG\r\n\x1a\n, then an IHDR chunk whose first two fields are the size.
  if (b.length < 24 || ascii(b, 1, 3) !== "PNG") return null;
  return { width: u32be(b, 16), height: u32be(b, 20) };
}

function gif(b: Uint8Array): Dimensions | null {
  if (b.length < 10 || ascii(b, 0, 3) !== "GIF") return null;
  return { width: u16le(b, 6), height: u16le(b, 8) };
}

function jpeg(b: Uint8Array): Dimensions | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;

  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) {
      i += 1; // Resynchronise rather than give up: padding between segments is legal.
      continue;
    }
    const marker = b[i + 1] ?? 0;
    // SOF0–SOF15 carry the frame size. DHT (c4), JPG (c8) and DAC (cc) sit in the range
    // and do not, which is the mistake every hand-rolled JPEG parser makes.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: u16be(b, i + 5), width: u16be(b, i + 7) };
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) {
      i += 2; // Standalone markers carry no length.
      continue;
    }
    i += 2 + u16be(b, i + 2);
  }
  return null;
}

function webp(b: Uint8Array): Dimensions | null {
  if (b.length < 30 || ascii(b, 0, 4) !== "RIFF" || ascii(b, 8, 4) !== "WEBP") return null;
  const chunk = ascii(b, 12, 4);

  if (chunk === "VP8 ") {
    // Lossy: a 3-byte start code, then 14-bit width and height.
    return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
  }
  if (chunk === "VP8L") {
    // Lossless: 14 bits each, packed across four bytes after the signature byte.
    const bits = u32be(b, 21);
    const packed = ((bits >>> 24) | (((bits >>> 16) & 0xff) << 8) | (((bits >>> 8) & 0xff) << 16) | ((bits & 0xff) << 24)) >>> 0;
    return { width: (packed & 0x3fff) + 1, height: ((packed >>> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8X") {
    // Extended: canvas size, stored minus one.
    return { width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
  }
  return null;
}

export function imageDimensions(body: Uint8Array): Dimensions | null {
  for (const read of [png, gif, jpeg, webp]) {
    const found = read(body);
    // A parser that returns a zero has misread the header; treat it as unknown.
    if (found && found.width > 0 && found.height > 0) return found;
  }
  // AVIF and SVG are deliberately absent: one needs a full ISOBMFF walk, the other has no
  // intrinsic pixel size. Both upload fine and render without the attributes.
  return null;
}
