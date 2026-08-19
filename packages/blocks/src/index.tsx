import { defineBlock, field } from "@mimnets/core";

/**
 * The standard Block library. The library grows to roughly twenty at M8.5, which is what
 * makes generated Presets look genuinely different from one another (ADR-0007).
 *
 * Blocks are styled with class names and Theme tokens only. Never hardcode a colour or a
 * font here — a Site's theme.ts supplies those, and that is what lets one library look like
 * five brands.
 */

export const headingBlock = defineBlock({
  name: "heading",
  label: "Heading",
  fields: {
    text: field.text({ label: "Heading text", default: "Heading" }),
    level: field.select({ label: "Level", options: ["h1", "h2", "h3"], default: "h2" }),
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
  render: ({ image, caption }, context) => {
    if (!image.key) return null;
    return (
      <figure className="mn-image">
        {/* width and height are what stop the text below shifting as the image arrives;
            they are absent only for formats that hide their size (AVIF) or have none (SVG). */}
        <img
          src={`${context.mediaBaseUrl}/${image.key}`}
          alt={image.alt}
          width={image.width ?? undefined}
          height={image.height ?? undefined}
          loading="lazy"
          decoding="async"
        />
        {caption ? <figcaption>{caption}</figcaption> : null}
      </figure>
    );
  },
});

export const logoBlock = defineBlock({
  name: "logo",
  label: "Logo",
  fields: {
    image: field.image({ label: "Logo image", help: "Leave empty to use text instead" }),
    text: field.text({ label: "Text logo", default: "" }),
    href: field.text({ label: "Links to", default: "/" }),
  },
  render: ({ image, text, href }, context) => (
    <a className="mn-logo" href={href || "/"}>
      {image.key ? (
        <img
          src={`${context.mediaBaseUrl}/${image.key}`}
          alt={image.alt || text || context.siteName}
          width={image.width ?? undefined}
          height={image.height ?? undefined}
        />
      ) : (
        <span className="mn-logo-text">{text || context.siteName}</span>
      )}
    </a>
  ),
});

/**
 * Renders a Menu by slug rather than holding its own copy of the links, so editing the Menu
 * updates the Header and the Footer together.
 *
 * The mobile drawer is a checkbox and CSS, with no JavaScript: navigation is the one thing
 * on a Site that has to work before anything else has loaded.
 */
export const menuBlock = defineBlock({
  name: "menu",
  label: "Menu",
  fields: {
    slug: field.text({ label: "Menu", default: "main", help: "Which Menu to show" }),
    align: field.select({ label: "Alignment", options: ["start", "center", "end"], default: "end" }),
  },
  render: ({ slug, align }, context) => {
    const items = context.menus[slug] ?? [];
    const toggleId = `mn-nav-${slug}`;

    if (items.length === 0) {
      return <nav className="mn-nav" data-empty="true" aria-label="Navigation" />;
    }

    return (
      <nav className="mn-nav" style={{ justifyContent: align }} aria-label="Navigation">
        {/* The checkbox is the control a keyboard reaches, so the name belongs on it.
            The label is the thing a thumb hits, and its bars carry no meaning. */}
        <input type="checkbox" id={toggleId} className="mn-nav-toggle" aria-label="Menu" />
        <label htmlFor={toggleId} className="mn-nav-button" aria-hidden="true">
          <span />
          <span />
          <span />
        </label>

        <ul className="mn-nav-list">
          {items.map((item) => (
            <li key={item.id}>
              <a
                href={item.href}
                target={item.newTab ? "_blank" : undefined}
                rel={item.newTab ? "noreferrer" : undefined}
                aria-current={item.href === context.currentPath ? "page" : undefined}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    );
  },
});

/** Registered by a Site in its blocks.config.ts, alongside any Blocks of its own. */
export const standardBlocks = [headingBlock, textBlock, imageBlock, logoBlock, menuBlock];
