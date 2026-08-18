import { defineBlock, field } from "@mimnets/core";

/**
 * The standard Block library. Three Blocks is enough to prove the interface at M1; the
 * library grows to roughly twenty at M8.5, which is what makes generated Presets look
 * genuinely different from one another (ADR-0007).
 *
 * Blocks are styled with class names only. Never hardcode a colour or a font here — a Site's
 * Theme supplies those, and that is what lets one library look like five brands.
 */

export const headingBlock = defineBlock({
  name: "heading",
  label: "Heading",
  fields: {
    text: field.text({ label: "Heading text", default: "Heading" }),
    level: field.select({
      label: "Level",
      options: ["h1", "h2", "h3"],
      default: "h2",
    }),
    align: field.select({
      label: "Alignment",
      options: ["left", "center", "right"],
      default: "left",
    }),
  },
  render: ({ text, level, align }) => {
    const Tag = level;
    return (
      <Tag className="mn-heading" style={{ textAlign: align }}>
        {text}
      </Tag>
    );
  },
});

export const textBlock = defineBlock({
  name: "text",
  label: "Text",
  fields: {
    body: field.textarea({ label: "Body", default: "" }),
  },
  render: ({ body }) => (
    <div className="mn-text">
      {body
        .split(/\n{2,}/)
        .filter((paragraph) => paragraph.trim() !== "")
        .map((paragraph, index) => (
          // Paragraphs have no identity of their own — they are split out of one string.
          // eslint-disable-next-line react/no-array-index-key
          <p key={index}>{paragraph}</p>
        ))}
    </div>
  ),
});

export const imageBlock = defineBlock({
  name: "image",
  label: "Image",
  fields: {
    image: field.image({ label: "Image" }),
    caption: field.text({ label: "Caption", default: "" }),
  },
  render: ({ image, caption }) => {
    if (!image.url) return null;
    return (
      <figure className="mn-image">
        {/* A plain <img> until M6 introduces uploads and knows an image's dimensions. */}
        <img src={image.url} alt={image.alt} />
        {caption ? <figcaption>{caption}</figcaption> : null}
      </figure>
    );
  },
});

/** Registered by a Site in its blocks.config.ts, alongside any Blocks of its own. */
export const standardBlocks = [headingBlock, textBlock, imageBlock];
