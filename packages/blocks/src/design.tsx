import { defineBlock, field } from "@mimnets/core";

/**
 * Blocks that carry a design.
 *
 * The Blocks in `index.tsx` are content: a heading, a paragraph, a picture. These are
 * composition — the arrangements that make a Page look like it was designed rather than
 * typed. A Site with six Block Types and a Site with twenty look like different products,
 * which is also why AI Presets are worth nothing until this file exists (ADR-0007).
 *
 * None of them paints its own background. A full-width band is a Section's job, because a
 * Block is constrained to its Column and would need a CSS breakout hack to reach the edges.
 */

/** A short label above a heading. Small, coloured, and the cheapest hierarchy there is. */
export const eyebrowBlock = defineBlock({
  name: "eyebrow",
  label: "Eyebrow",
  fields: {
    text: field.text({ label: "Text", default: "" }),
  },
  render: ({ text }) => (text ? <p className="mn-eyebrow">{text}</p> : null),
});

/**
 * A link styled as a button.
 *
 * A Block rather than a field on every other Block: a call to action moves around a Page,
 * and making it a Block means dragging it there rather than deciding in advance which Block
 * should own one.
 */
export const buttonBlock = defineBlock({
  name: "button",
  label: "Button",
  fields: {
    label: field.text({ label: "Label", default: "Learn more" }),
    href: field.text({ label: "Links to", default: "/" }),
    style: field.select({
      label: "Style",
      options: ["primary", "accent", "outline"],
      default: "primary",
    }),
    size: field.select({ label: "Size", options: ["medium", "large"], default: "medium" }),
  },
  render: ({ label, href, style, size }) =>
    label ? (
      <a className="mn-btn" data-style={style} data-size={size} href={href || "/"}>
        {label}
      </a>
    ) : null,
});

/**
 * A grid of short, titled points — what a Site does, in three or four pieces.
 *
 * The icon is an emoji rather than an icon set. A Site that needs real icons registers a
 * Block of its own; every Site that does not gets something usable with no font, no sprite
 * sheet and no licence.
 */
export const featuresBlock = defineBlock({
  name: "features",
  label: "Feature grid",
  fields: {
    columns: field.select({ label: "Across", options: ["2", "3", "4"], default: "3" }),
    items: field.repeater({
      label: "Features",
      fields: {
        icon: field.text({ label: "Icon", help: "An emoji, or leave it empty", default: "" }),
        title: field.text({ label: "Title", default: "" }),
        body: field.textarea({ label: "Body", default: "" }),
      },
    }),
  },
  render: ({ columns, items }) => {
    if (items.length === 0) return null;
    return (
      <ul className="mn-features" data-columns={columns}>
        {items.map((item, index) => (
          // Features are positional and have no identity of their own.
          // eslint-disable-next-line react/no-array-index-key
          <li className="mn-feature" key={index}>
            {item.icon ? (
              <span className="mn-feature-icon" aria-hidden="true">
                {item.icon}
              </span>
            ) : null}
            {item.title ? <h3 className="mn-heading">{item.title}</h3> : null}
            {item.body ? <p className="mn-muted">{item.body}</p> : null}
          </li>
        ))}
      </ul>
    );
  },
});

/** Numbers, large. A row of these is the fastest way to make a Page look substantial. */
export const statsBlock = defineBlock({
  name: "stats",
  label: "Statistics",
  fields: {
    items: field.repeater({
      label: "Statistics",
      fields: {
        value: field.text({ label: "Value", default: "" }),
        label: field.text({ label: "Label", default: "" }),
      },
    }),
  },
  render: ({ items }) => {
    if (items.length === 0) return null;
    return (
      <dl className="mn-stats">
        {items.map((item, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <div className="mn-stat" key={index}>
            <dt className="mn-stat-value">{item.value}</dt>
            <dd className="mn-stat-label">{item.label}</dd>
          </div>
        ))}
      </dl>
    );
  },
});

/** What other people said, marked up as a blockquote because that is what it is. */
export const testimonialBlock = defineBlock({
  name: "testimonial",
  label: "Testimonials",
  fields: {
    items: field.repeater({
      label: "Quotes",
      fields: {
        quote: field.textarea({ label: "Quote", default: "" }),
        name: field.text({ label: "Name", default: "" }),
        role: field.text({ label: "Role", default: "" }),
        image: field.image({ label: "Photograph" }),
      },
    }),
  },
  render: ({ items }, context) => {
    if (items.length === 0) return null;
    return (
      <div className="mn-quotes">
        {items.map((item, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <figure className="mn-quote" key={index}>
            <blockquote>{item.quote}</blockquote>
            <figcaption>
              {item.image.key ? (
                <img
                  src={`${context.mediaBaseUrl}/${item.image.key}`}
                  alt=""
                  width={item.image.width ?? undefined}
                  height={item.image.height ?? undefined}
                  loading="lazy"
                />
              ) : null}
              <span>
                <strong>{item.name}</strong>
                {item.role ? <em>{item.role}</em> : null}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    );
  },
});

/**
 * A row of client or partner marks.
 *
 * Faded until hovered by default, which is the convention: a logo strip is there to be
 * recognised at a glance, not to compete with the Page's own colour.
 */
export const logosBlock = defineBlock({
  name: "logos",
  label: "Logo strip",
  fields: {
    title: field.text({ label: "Title", default: "" }),
    muted: field.boolean({ label: "Fade until hovered", default: true }),
    items: field.repeater({
      label: "Logos",
      fields: { image: field.image({ label: "Logo" }) },
    }),
  },
  render: ({ title, muted, items }, context) => {
    const shown = items.filter((item) => item.image.key);
    if (shown.length === 0) return null;
    return (
      <div className="mn-logos" data-muted={muted ? "true" : undefined}>
        {title ? <p className="mn-logos-title">{title}</p> : null}
        <ul>
          {shown.map((item, index) => (
            // eslint-disable-next-line react/no-array-index-key
            <li key={index}>
              <img
                src={`${context.mediaBaseUrl}/${item.image.key}`}
                alt={item.image.alt}
                width={item.image.width ?? undefined}
                height={item.image.height ?? undefined}
                loading="lazy"
              />
            </li>
          ))}
        </ul>
      </div>
    );
  },
});

/**
 * The band that asks for something: a heading, a sentence and a button.
 *
 * It reads best in a Section with a primary or dark tone, which is exactly why it carries no
 * background of its own.
 */
export const ctaBlock = defineBlock({
  name: "cta",
  label: "Call to action",
  fields: {
    heading: field.text({ label: "Heading", default: "" }),
    body: field.textarea({ label: "Body", default: "" }),
    buttonLabel: field.text({ label: "Button", default: "" }),
    buttonHref: field.text({ label: "Links to", default: "/contact" }),
    align: field.select({ label: "Alignment", options: ["center", "left"], default: "center" }),
  },
  render: ({ heading, body, buttonLabel, buttonHref, align }) => (
    <div className="mn-cta" data-align={align}>
      {heading ? <h2 className="mn-heading">{heading}</h2> : null}
      {body ? <p className="mn-text">{body}</p> : null}
      {buttonLabel ? (
        <a className="mn-btn" data-style="accent" data-size="large" href={buttonHref || "/"}>
          {buttonLabel}
        </a>
      ) : null}
    </div>
  ),
});

/**
 * One pricing plan. Three of these across a three-Column Section is a pricing page.
 *
 * One plan per Block rather than one Block holding every plan, so the Columns do the
 * arranging — that is what Columns are for, and it means a Site can have two plans on one
 * Page and four on another without a new field.
 */
export const pricingBlock = defineBlock({
  name: "pricing",
  label: "Pricing plan",
  fields: {
    name: field.text({ label: "Plan name", default: "" }),
    price: field.text({ label: "Price", default: "" }),
    period: field.text({ label: "Per", default: "month" }),
    featured: field.boolean({ label: "Highlight this plan", default: false }),
    lines: field.repeater({
      label: "What is included",
      fields: { text: field.text({ label: "Line", default: "" }) },
    }),
    buttonLabel: field.text({ label: "Button", default: "Choose" }),
    buttonHref: field.text({ label: "Links to", default: "/contact" }),
  },
  render: ({ name, price, period, featured, lines, buttonLabel, buttonHref }) => (
    <div className="mn-plan" data-featured={featured ? "true" : undefined}>
      {name ? <h3 className="mn-heading">{name}</h3> : null}
      {price ? (
        <p className="mn-plan-price">
          <strong>{price}</strong>
          {period ? <span>/{period}</span> : null}
        </p>
      ) : null}
      {lines.length > 0 ? (
        <ul className="mn-plan-lines">
          {lines.map((line, index) => (
            // eslint-disable-next-line react/no-array-index-key
            <li key={index}>{line.text}</li>
          ))}
        </ul>
      ) : null}
      {buttonLabel ? (
        <a
          className="mn-btn"
          data-style={featured ? "primary" : "outline"}
          href={buttonHref || "/"}
        >
          {buttonLabel}
        </a>
      ) : null}
    </div>
  ),
});

export const designBlocks = [
  eyebrowBlock,
  buttonBlock,
  featuresBlock,
  statsBlock,
  testimonialBlock,
  logosBlock,
  ctaBlock,
  pricingBlock,
];
