import { defineBlock, field, renderMarkdown, safeHref } from "@mimnets/core";
import type { RenderContext } from "@mimnets/core";

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

/**
 * A short label above a heading. Small, coloured, and the cheapest hierarchy there is.
 *
 * The first Block to offer a Theme colour rather than owning one. It was `--mn-color-accent`
 * and `accent` is still the default, so no eyebrow on any Site changes colour -- the same
 * rule the first declared variant follows, and for the same reason.
 */
export const eyebrowBlock = defineBlock({
  name: "eyebrow",
  label: "Eyebrow",
  fields: {
    text: field.text({ label: "Text", default: "" }),
    colour: field.token({
      label: "Colour",
      help: "One of the Theme's colours, so it changes when the Site is rebranded.",
      tokens: ["accent", "primary", "accentText", "primaryText"],
      default: "accent",
    }),
  },
  // The name, not the colour: `blocks.css` maps it to the token. Nothing here can carry a
  // colour the Theme does not know, which is the point of the field.
  render: ({ text, colour }) =>
    text ? (
      <p className="mn-eyebrow" data-colour={colour}>
        {text}
      </p>
    ) : null,
});


/**
 * The panel half of a popover, shared by every Block that can open one.
 *
 * Extracted when the button gained a panel, because the alternative was a second copy of the
 * checkbox/backdrop/panel markup — and a second copy is how the Editor's preview drifted
 * from the renderer in the first place. One shape, one stylesheet, one set of rules about
 * what closes it.
 *
 * The caller owns the id and the checkbox. That is deliberate: the checkbox has to be a
 * *sibling* preceding the panel for `:checked ~ .mn-popover` to select it, and only the
 * caller knows what else is in its own markup.
 */
function PopoverPanel({
  id,
  heading,
  body,
  image,
  context,
}: {
  id: string;
  heading: string;
  body: string;
  image?: { key: string; alt: string; decorative?: boolean; width?: number | null; height?: number | null };
  context: RenderContext;
}) {
  return (
    <div className="mn-popover">
      <label htmlFor={id} className="mn-popover-backdrop" aria-hidden="true" />

      <div className="mn-popover-panel">
        <label htmlFor={id} className="mn-popover-close" aria-hidden="true">
          <span>&times;</span>
        </label>

        {image?.key ? (
          <img
            className="mn-popover-image"
            src={`${context.mediaBaseUrl}/${image.key}`}
            alt={image.decorative ? "" : image.alt}
            width={image.width ?? undefined}
            height={image.height ?? undefined}
            loading="lazy"
          />
        ) : null}

        {heading ? <h3 className="mn-popover-heading">{heading}</h3> : null}
        {/* The same Markdown renderer the prose Block uses, so raw HTML is never parsed --
            an Author is a client, which is ADR-0011's argument. */}
        <div className="mn-prose">{renderMarkdown(body)}</div>
      </div>
    </div>
  );
}

/** Whether an Author actually filled a panel in. An empty one is a link, not a popover. */
function hasPanel(panel: { heading: string; body: string }): boolean {
  return Boolean(panel.heading || panel.body);
}

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
  /**
   * This was a `style` field before there were variants, which is the reason variants exist
   * — a look declared as a field is a look only this Block Type knows how to have. Named
   * identically so every button already stored keeps the one it was given; `variantWasField`
   * lifts the value out of `props` at parse time.
   */
  variants: ["primary", "accent", "outline"],
  variantWasField: "style",
  fields: {
    label: field.text({ label: "Label", default: "Learn more" }),
    href: field.text({ label: "Links to", default: "/" }),
    size: field.select({ label: "Size", options: ["medium", "large"], default: "medium" }),
    /**
     * Fill either of these in and the button opens a panel instead of going anywhere.
     *
     * Flat fields rather than a group, because `defineBlock` has no group and the Editor
     * generates its controls from this shape. Named so they sort together in the panel.
     */
    panelHeading: field.text({ label: "Panel heading", default: "" }),
    panelBody: field.textarea({
      label: "Panel text",
      help: "Fill this in and the button opens a panel instead of following its link.",
      default: "",
    }),
    panelImage: field.image({ label: "Panel picture", help: "Optional" }),
  },
  render: ({ label, href, size, panelHeading, panelBody, panelImage }, context, meta) => {
    if (!label) return null;

    const panel = { heading: panelHeading, body: panelBody };

    /**
     * A button either goes somewhere or opens something, and it cannot do both.
     *
     * An anchor that opened a panel and also navigated would do the second on click and the
     * first a moment later, which is a link that appears to flash a panel at you. So the
     * panel wins when an Author has written one, and the "Links to" field is simply unused
     * -- visible in the Editor, ignored here, which is the honest way round: the alternative
     * is hiding a field whose value is still stored.
     */
    if (hasPanel(panel)) {
      // The Block's own id, so two identical buttons on one Page still open their own
      // panels. This is what `meta` was added for; hashing the content would collide.
      const toggleId = `mn-pop-${meta.id}`;

      return (
        <>
          <input
            type="checkbox"
            id={toggleId}
            className="mn-popover-toggle"
            aria-label={panelHeading ? `${label}: ${panelHeading}` : label}
          />
          <label htmlFor={toggleId} className="mn-btn" data-size={size} aria-hidden="true">
            {label}
          </label>
          <PopoverPanel
            id={toggleId}
            heading={panelHeading}
            body={panelBody}
            image={panelImage}
            context={context}
          />
        </>
      );
    }

    // Author input that becomes an href, so it goes through the same check the call to
    // action, a pricing plan, the carousel, the comparison table, the menu and the social
    // row all use. This Block was the one that did not, and it is the most likely of the
    // lot to carry a link somebody typed: React refuses `javascript:` on its own, which is
    // why nothing looked wrong, and refuses neither `vbscript:` nor a `data:` URL.
    return (
      <a className="mn-btn" data-size={size} href={safeHref(href) || "/"}>
        {label}
      </a>
    );
  },
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
  /**
   * The Block M11's exit criterion is written about: the same testimonial looking like three
   * different Sites without a line of new render code.
   *
   * "card" is what it has always been and is therefore first. "quote" drops the card
   * entirely and sets the words at display size behind a large open quote — editorial rather
   * than SaaS. "minimal" is a rule and a name, which is what a Site with a lot of them wants.
   *
   * None of this reaches `render` below, which is unchanged.
   */
  variants: ["card", "quote", "minimal"],
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
        <a className="mn-btn" data-style="accent" data-size="large" href={safeHref(buttonHref) || "/"}>
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
          href={safeHref(buttonHref) || "/"}
        >
          {buttonLabel}
        </a>
      ) : null}
    </div>
  ),
});

/** A short, stable, non-cryptographic name for a string. Used only to group `<details>`. */
function stableName(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

/**
 * A stack of questions that open one at a time.
 *
 * Built on `<details>` and `<summary>` rather than buttons and `aria-expanded`, which is a
 * deliberate choice and not a lazy one. The native element is keyboard operable, announced
 * correctly, expandable before hydration and findable by the browser's own in-page search —
 * a JavaScript accordion is none of those until its script arrives, and Blocks render on the
 * server. The `name` attribute is what makes it exclusive; browsers without it simply let
 * more than one stand open, which is a degradation nobody notices.
 */
export const accordionBlock = defineBlock({
  name: "accordion",
  label: "Accordion",
  fields: {
    title: field.text({ label: "Title", default: "" }),
    items: field.repeater({
      label: "Questions",
      fields: {
        question: field.text({ label: "Question", default: "" }),
        answer: field.textarea({ label: "Answer", default: "" }),
      },
    }),
    exclusive: field.boolean({
      label: "Open one at a time",
      help: "Opening a question closes the one before it.",
      default: true,
    }),
    openFirst: field.boolean({
      label: "Start with the first one open",
      help: "Shows a visitor what the answers look like before they click anything.",
      default: false,
    }),
  },
  render: ({ title, items, exclusive, openFirst }) => {
    if (items.length === 0) return null;

    // Two accordions on one Page must not close each other's questions, so the group name
    // cannot be a constant. There is no Block id to reach for — `RenderContext` is resolved
    // once per request by design, and a hook is not available because Blocks render on the
    // server — so the name is derived from the questions themselves. Two accordions would
    // have to hold the same questions in the same order to collide, and the cost if they
    // did is that they share a group rather than anything breaking.
    const group = `mn-acc-${stableName(items.map((item) => item.question).join("\n"))}`;

    return (
      <div className="mn-accordion">
        {title ? <h2 className="mn-accordion-title">{title}</h2> : null}
        {items.map((item, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <details
            className="mn-accordion-item"
            key={index}
            name={exclusive ? group : undefined}
            open={openFirst && index === 0}
          >
            <summary>{item.question}</summary>
            <div className="mn-accordion-answer">{item.answer}</div>
          </details>
        ))}
      </div>
    );
  },
});

/**
 * A grid of photographs, each one enlargeable.
 *
 * The lightbox is CSS `:target` and no JavaScript, which is a deliberate choice with a real
 * cost attached. What it buys: the gallery works in a Site that has not hydrated, on a slow
 * connection, and in a feed reader; enlarging an image is a link, so it is keyboard operable
 * and middle-clickable without anyone implementing either. What it costs: opening an image
 * pushes a history entry, so Back closes it rather than leaving the Page, and there is no
 * Escape key.
 *
 * Note what is deliberately *absent*: `aria-modal`. Without focus management the attribute is
 * a claim the keyboard contradicts — the same fault the media picker's trap exists to fix.
 * An overlay that says it is modal while Tab walks out behind it is worse than one that
 * never claimed to be. Adding Escape, focus containment and arrow keys means a client
 * component, which would be the first in this package.
 */
export const galleryBlock = defineBlock({
  name: "gallery",
  label: "Image gallery",
  fields: {
    title: field.text({ label: "Title", default: "" }),
    items: field.repeater({
      label: "Images",
      fields: {
        image: field.image({ label: "Image" }),
        caption: field.text({ label: "Caption", default: "" }),
      },
    }),
    columns: field.select({
      label: "Columns",
      options: ["2", "3", "4"],
      default: "3",
    }),
    enlarge: field.boolean({
      label: "Let visitors enlarge an image",
      help: "Opening an image adds a step to the browser's Back button.",
      default: true,
    }),
  },
  render: ({ title, items, columns, enlarge }, context) => {
    const shown = items.filter((item) => item.image.key);
    if (shown.length === 0) return null;

    // Scoped to this Block so two galleries on a Page cannot target each other's images, on
    // the same reasoning as the accordion's group name.
    const scope = stableName(shown.map((item) => item.image.key).join("\n"));
    const url = (key: string) => `${context.mediaBaseUrl}/${key}`;

    return (
      <div className="mn-gallery" id={`mn-gal-${scope}`} data-columns={columns}>
        {title ? <h2 className="mn-gallery-title">{title}</h2> : null}

        <ul className="mn-gallery-grid">
          {shown.map((item, index) => {
            const figure = (
              <figure className="mn-gallery-figure">
                <img
                  src={url(item.image.key)}
                  alt={item.image.decorative ? "" : item.image.alt}
                  width={item.image.width ?? undefined}
                  height={item.image.height ?? undefined}
                  loading="lazy"
                />
                {item.caption ? <figcaption>{item.caption}</figcaption> : null}
              </figure>
            );

            return (
              // eslint-disable-next-line react/no-array-index-key
              <li className="mn-gallery-cell" key={index}>
                {enlarge ? (
                  <a
                    className="mn-gallery-open"
                    href={`#mn-gal-${scope}-${index}`}
                    aria-label={`Enlarge: ${item.image.alt || item.caption || `image ${index + 1}`}`}
                  >
                    {figure}
                  </a>
                ) : (
                  figure
                )}
              </li>
            );
          })}
        </ul>

        {enlarge
          ? shown.map((item, index) => (
              // eslint-disable-next-line react/no-array-index-key
              <div className="mn-gallery-full" id={`mn-gal-${scope}-${index}`} key={index}>
                <a
                  className="mn-gallery-close"
                  href={`#mn-gal-${scope}`}
                  aria-label="Close the enlarged image"
                >
                  <span aria-hidden="true">&times;</span>
                </a>
                <img
                  src={url(item.image.key)}
                  alt={item.image.decorative ? "" : item.image.alt}
                  width={item.image.width ?? undefined}
                  height={item.image.height ?? undefined}
                />
                {item.caption ? <p className="mn-gallery-full-caption">{item.caption}</p> : null}
                <nav className="mn-gallery-step">
                  {index > 0 ? (
                    <a href={`#mn-gal-${scope}-${index - 1}`} rel="prev">
                      Previous
                    </a>
                  ) : null}
                  {index < shown.length - 1 ? (
                    <a href={`#mn-gal-${scope}-${index + 1}`} rel="next">
                      Next
                    </a>
                  ) : null}
                </nav>
              </div>
            ))
          : null}
      </div>
    );
  },
});

/**
 * A horizontal run of slides.
 *
 * CSS scroll-snap does the work, so there is no timer, no transform and no JavaScript. The
 * track is a scroll region with a label and a tabindex, which is the pattern that makes a
 * scrollable box operable from the keyboard — arrow keys scroll it because the browser
 * scrolls focused overflow containers, not because anything here handles a key. The dots are
 * links to slide ids, so they work for the same reason the gallery's do.
 *
 * There is no autoplay, and that is a decision rather than an omission. A carousel that moves
 * on its own takes the reading speed out of the reader's hands, and every accessible
 * implementation ends up shipping a pause button to undo it. If a Site needs motion, a
 * Section's reveal already provides it.
 */
export const carouselBlock = defineBlock({
  name: "carousel",
  label: "Carousel",
  fields: {
    title: field.text({ label: "Title", default: "" }),
    items: field.repeater({
      label: "Slides",
      fields: {
        image: field.image({ label: "Image" }),
        heading: field.text({ label: "Heading", default: "" }),
        text: field.textarea({ label: "Text", default: "" }),
        link: field.link({ label: "Link" }),
      },
    }),
    width: field.select({
      label: "Slide width",
      options: ["full", "wide", "narrow"],
      default: "wide",
    }),
  },
  render: ({ title, items, width }, context) => {
    if (items.length === 0) return null;

    const scope = stableName(
      items.map((item) => `${item.image.key}${item.heading}`).join("\n"),
    );
    const label = title || "Carousel";

    return (
      <div className="mn-carousel" data-width={width}>
        {title ? <h2 className="mn-carousel-title">{title}</h2> : null}

        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
        <ul
          className="mn-carousel-track"
          role="region"
          aria-label={label}
          tabIndex={0}
        >
          {items.map((item, index) => (
            // eslint-disable-next-line react/no-array-index-key
            <li className="mn-carousel-slide" id={`mn-car-${scope}-${index}`} key={index}>
              {item.image.key ? (
                <img
                  src={`${context.mediaBaseUrl}/${item.image.key}`}
                  alt={item.image.decorative ? "" : item.image.alt}
                  width={item.image.width ?? undefined}
                  height={item.image.height ?? undefined}
                  loading={index === 0 ? undefined : "lazy"}
                />
              ) : null}
              {item.heading || item.text || item.link.label ? (
                <div className="mn-carousel-body">
                  {item.heading ? <h3>{item.heading}</h3> : null}
                  {item.text ? <p>{item.text}</p> : null}
                  {item.link.label ? (
                    <a
                      className="mn-carousel-link"
                      href={safeHref(item.link.href) || "/"}
                      target={item.link.newTab ? "_blank" : undefined}
                      rel={item.link.newTab ? "noreferrer" : undefined}
                    >
                      {item.link.label}
                    </a>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>

        {items.length > 1 ? (
          <nav className="mn-carousel-dots" aria-label={`${label}: choose a slide`}>
            {items.map((item, index) => (
              <a
                // eslint-disable-next-line react/no-array-index-key
                key={index}
                href={`#mn-car-${scope}-${index}`}
                aria-label={item.heading || `Slide ${index + 1}`}
              >
                <span aria-hidden="true" />
              </a>
            ))}
          </nav>
        ) : null}
      </div>
    );
  },
});

/** How much of the world a zoom level shows, in degrees of longitude. */
const MAP_SPANS = { street: 0.006, area: 0.03, city: 0.12 } as const;

/**
 * A map with a pin in it.
 *
 * OpenStreetMap by default, and the default is the point. Its embed needs no API key, no
 * account and no billing alarm, and it sets no third-party cookies — so a Site can show
 * visitors where it is without acquiring a consent banner to do it. Google Maps is offered
 * for Sites that want it, and choosing it is choosing that banner; the help text says so
 * rather than leaving an Owner to discover it from a compliance email.
 *
 * The Google key is an ordinary field rather than an environment variable on purpose. A Maps
 * Embed key travels in the URL the visitor's browser requests, so it is public by
 * construction — treating it as a secret would imply a protection that does not exist. What
 * actually protects it is an HTTP-referrer restriction, which is what the help text asks for.
 *
 * Below the frame there is always a plain link to the map. An iframe that a corporate proxy,
 * a content blocker or a printer drops should still leave a visitor able to find the place.
 */
export const mapBlock = defineBlock({
  name: "map",
  label: "Location map",
  fields: {
    label: field.text({
      label: "Place name",
      help: "Shown under the map and used to describe it to a screen reader.",
      default: "",
    }),
    latitude: field.number({ label: "Latitude", default: 0 }),
    longitude: field.number({ label: "Longitude", default: 0 }),
    zoom: field.select({
      label: "Zoom",
      options: ["street", "area", "city"],
      default: "street",
    }),
    height: field.select({
      label: "Height",
      options: ["short", "medium", "tall"],
      default: "medium",
    }),
    provider: field.select({
      label: "Map provider",
      help: "OpenStreetMap needs no key and sets no third-party cookies. Google Maps does both.",
      options: ["openstreetmap", "google"],
      default: "openstreetmap",
    }),
    googleKey: field.text({
      label: "Google Maps embed key",
      help: "Only used for Google. Public by design — restrict it by HTTP referrer in the Google console.",
      default: "",
    }),
  },
  render: ({ label, latitude, longitude, zoom, height, provider, googleKey }) => {
    // 0,0 is the Gulf of Guinea. It is the schema default rather than anywhere an Author
    // meant, so an unconfigured map draws nothing instead of pinning the Atlantic.
    if (latitude === 0 && longitude === 0) return null;

    const useGoogle = provider === "google" && googleKey !== "";
    const span = MAP_SPANS[zoom as keyof typeof MAP_SPANS] ?? MAP_SPANS.street;
    const title = label ? `Map showing ${label}` : "Map";

    const src = useGoogle
      ? `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(googleKey)}&q=${latitude},${longitude}&zoom=${zoom === "street" ? 17 : zoom === "area" ? 15 : 13}`
      : `https://www.openstreetmap.org/export/embed.html?bbox=${longitude - span},${latitude - span / 2},${longitude + span},${latitude + span / 2}&layer=mapnik&marker=${latitude},${longitude}`;

    const away = useGoogle
      ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
      : `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`;

    return (
      <figure className="mn-map" data-height={height}>
        <iframe
          className="mn-map-frame"
          title={title}
          src={src}
          loading="lazy"
          // The frame needs nothing from this Site and should be able to do nothing to it.
          referrerPolicy="no-referrer-when-downgrade"
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
        />
        <figcaption className="mn-map-caption">
          {label ? <span>{label}</span> : null}
          <a href={away} target="_blank" rel="noreferrer">
            Open the map
          </a>
        </figcaption>
      </figure>
    );
  },
});

/**
 * Turns a video URL an Author pasted into a frame, or refuses to.
 *
 * The refusal is the feature. `src` on an iframe is not a display setting — it decides which
 * origin gets to run code in a frame on this Site, and an Author is a client, which is the
 * same reason ADR-0011 keeps raw HTML out of Markdown. So this is an allowlist: two providers
 * are recognised and everything else falls through to a plain link, which can be wrong
 * without being dangerous.
 *
 * YouTube goes to youtube-nocookie.com, which is the same player without the tracking cookie
 * on arrival.
 */
function embedFrom(raw: string): { kind: "frame"; src: string } | { kind: "link" } | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    // Half a URL, mid-keystroke. Not an error — just nothing to show yet.
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.hostname.replace(/^www\./, "");

  if (host === "youtube.com" || host === "m.youtube.com") {
    const id = url.searchParams.get("v") ?? url.pathname.replace(/^\/embed\//, "");
    if (/^[\w-]{6,}$/.test(id)) {
      return { kind: "frame", src: `https://www.youtube-nocookie.com/embed/${id}` };
    }
  }

  if (host === "youtu.be") {
    const id = url.pathname.slice(1);
    if (/^[\w-]{6,}$/.test(id)) {
      return { kind: "frame", src: `https://www.youtube-nocookie.com/embed/${id}` };
    }
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = url.pathname.split("/").filter(Boolean).pop() ?? "";
    if (/^\d+$/.test(id)) {
      return { kind: "frame", src: `https://player.vimeo.com/video/${id}` };
    }
  }

  return { kind: "link" };
}

/**
 * A video from YouTube or Vimeo.
 *
 * Anything else becomes a link rather than a frame — see `embedFrom`. A link is a worse
 * result than a working player and a far better one than letting a Page decide which origin
 * runs code inside it.
 */
export const embedBlock = defineBlock({
  name: "embed",
  label: "Video",
  fields: {
    url: field.text({
      label: "Video address",
      help: "A YouTube or Vimeo link. Anything else is shown as a link rather than a player.",
      default: "",
    }),
    title: field.text({
      label: "What the video is",
      help: "Read out in place of the video by a screen reader, so describe it rather than naming the file.",
      default: "",
    }),
    ratio: field.select({
      label: "Shape",
      options: ["16:9", "4:3", "1:1"],
      default: "16:9",
    }),
  },
  render: ({ url, title, ratio }) => {
    const embed = embedFrom(url);
    if (!embed) return null;

    if (embed.kind === "link") {
      return (
        <p className="mn-embed-fallback">
          <a href={url} target="_blank" rel="noreferrer">
            {title || url}
          </a>
        </p>
      );
    }

    return (
      <div className="mn-embed" data-ratio={ratio}>
        <iframe
          className="mn-embed-frame"
          title={title || "Video"}
          src={embed.src}
          loading="lazy"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          // Same reasoning as the map: the frame needs nothing from this Site.
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-presentation"
        />
      </div>
    );
  },
});

/** Cell values that mean "this plan has it" and "it does not", however an Author wrote them. */
const CELL_YES = new Set(["yes", "y", "true", "included", "✓", "✔"]);
const CELL_NO = new Set(["no", "n", "false", "-", "–", "—", "✗", "✘", "none"]);

/**
 * A feature-by-plan comparison.
 *
 * A real `<table>`, because that is what this is: `<th scope="col">` on each plan and
 * `<th scope="row">` on each feature is what lets a screen reader say "Priority support,
 * Standard, no" instead of reading a wall of ticks with nothing to attach them to. A grid of
 * divs looks identical and says nothing.
 *
 * The shape is the awkward part and worth explaining. A comparison is two-dimensional and a
 * repeater is a list, so plans are one list, features are another, and each feature carries a
 * list of values positionally matched to the plans. That means an Author has to keep them in
 * order, which is a real cost — so the render is forgiving: a row with too few values gets
 * empty cells rather than a broken table, and extra values are ignored rather than spilling
 * a column no header covers.
 *
 * Ticks are never bare glyphs. "✓" alone is announced as nothing useful, so every one carries
 * the word next to it, hidden from the page and not from the reader.
 */
export const compareBlock = defineBlock({
  name: "compare",
  label: "Comparison table",
  fields: {
    title: field.text({ label: "Title", default: "" }),
    plans: field.repeater({
      label: "Plans",
      help: "The columns, left to right.",
      fields: {
        name: field.text({ label: "Name", default: "" }),
        price: field.text({ label: "Price", default: "" }),
        note: field.text({ label: "Note", default: "" }),
        link: field.link({ label: "Button" }),
        featured: field.boolean({ label: "Highlight this one", default: false }),
      },
    }),
    rows: field.repeater({
      label: "Features",
      help: "The rows. Each value lines up with a plan, in the same order.",
      fields: {
        label: field.text({ label: "Feature", default: "" }),
        values: field.repeater({
          label: "Value per plan",
          help: 'Write "yes" or "no" for a tick or a dash, or any other text to show as it is.',
          fields: {
            value: field.text({ label: "Value", default: "" }),
          },
        }),
      },
    }),
  },
  render: ({ title, plans, rows }) => {
    if (plans.length === 0) return null;

    const cell = (raw: string) => {
      const key = raw.trim().toLowerCase();
      if (key === "") return null;
      if (CELL_YES.has(key)) {
        return (
          <span className="mn-compare-yes">
            <span aria-hidden="true">✓</span>
            <span className="mn-visually-hidden">Included</span>
          </span>
        );
      }
      if (CELL_NO.has(key)) {
        return (
          <span className="mn-compare-no">
            <span aria-hidden="true">–</span>
            <span className="mn-visually-hidden">Not included</span>
          </span>
        );
      }
      return raw;
    };

    return (
      <div className="mn-compare">
        {title ? <h2 className="mn-compare-title">{title}</h2> : null}

        {/* A comparison of five plans does not fit a phone, and a page that scrolls sideways
            as a whole is worse than a table that scrolls inside its own box. */}
        <div className="mn-compare-scroll">
          <table>
            <caption className="mn-visually-hidden">{title || "Comparison of plans"}</caption>
            <thead>
              <tr>
                <td className="mn-compare-corner" />
                {plans.map((plan, index) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <th scope="col" key={index} data-featured={plan.featured ? "" : undefined}>
                    <span className="mn-compare-name">{plan.name}</span>
                    {plan.price ? <span className="mn-compare-price">{plan.price}</span> : null}
                    {plan.note ? <span className="mn-compare-note">{plan.note}</span> : null}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((row, rowIndex) => (
                // eslint-disable-next-line react/no-array-index-key
                <tr key={rowIndex}>
                  <th scope="row">{row.label}</th>
                  {plans.map((plan, columnIndex) => (
                    <td
                      // eslint-disable-next-line react/no-array-index-key
                      key={columnIndex}
                      data-featured={plan.featured ? "" : undefined}
                    >
                      {cell(row.values[columnIndex]?.value ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>

            {plans.some((plan) => plan.link.label) ? (
              <tfoot>
                <tr>
                  <td className="mn-compare-corner" />
                  {plans.map((plan, index) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <td key={index} data-featured={plan.featured ? "" : undefined}>
                      {plan.link.label ? (
                        <a
                          className="mn-button"
                          data-style={plan.featured ? "primary" : "outline"}
                          href={safeHref(plan.link.href) || "/"}
                          target={plan.link.newTab ? "_blank" : undefined}
                          rel={plan.link.newTab ? "noreferrer" : undefined}
                        >
                          {plan.link.label}
                        </a>
                      ) : null}
                    </td>
                  ))}
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>
    );
  },
});

/** How each network's name is spelled when nobody has overridden it. */
const SOCIAL_NAMES: Record<string, string> = {
  website: "Website",
  email: "Email",
  phone: "Phone",
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  tiktok: "TikTok",
  x: "X",
  bluesky: "Bluesky",
  github: "GitHub",
  whatsapp: "WhatsApp",
};

/**
 * Turns what an Author typed into an address a browser should follow, or refuses.
 *
 * Email and phone become mailto: and tel:. Everything else has to be http or https — the
 * field is a free-text box on a Page, so `javascript:` is a thing somebody can type into it,
 * and an href is all it takes for that to be a live one.
 */
function socialHref(network: string, raw: string): string | null {
  const value = raw.trim();
  if (value === "") return null;

  if (network === "email") {
    if (value.startsWith("mailto:")) return value;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? `mailto:${value}` : null;
  }

  if (network === "phone") {
    if (value.startsWith("tel:")) return value;
    // Digits, spaces and the punctuation a phone number is written with. Nothing else.
    return /^[+()\d][\s()+\-.\d]*$/.test(value) ? `tel:${value.replace(/[\s().-]/g, "")}` : null;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Where else to find this Site.
 *
 * No brand logos ship with this Block, and that is a decision. Bundling them would put
 * trademarked marks into a package every Site installs, each with its own usage terms about
 * colour, spacing and clear space that nobody would then be tracking — and a wrong-coloured
 * logo is a worse look than a word. Each link carries `data-network`, so a Theme that wants
 * glyphs supplies its own and styles them, and the default is a legible row of names.
 *
 * Every link is named for what it is rather than where it goes: "Instagram" reads better in a
 * list of links than "https://instagram.com/…", and a row of identical icons with no
 * accessible name is a row a screen reader announces as "link, link, link".
 */
export const socialBlock = defineBlock({
  name: "social",
  label: "Social links",
  fields: {
    title: field.text({ label: "Title", default: "" }),
    items: field.repeater({
      label: "Links",
      fields: {
        network: field.select({
          label: "Where",
          options: [
            "website",
            "email",
            "phone",
            "instagram",
            "facebook",
            "linkedin",
            "youtube",
            "tiktok",
            "x",
            "bluesky",
            "github",
            "whatsapp",
          ],
          default: "instagram",
        }),
        href: field.text({
          label: "Address",
          help: "A full web address, or an email address, or a phone number.",
          default: "",
        }),
        label: field.text({
          label: "Name it differently",
          help: "Optional. Defaults to the name of the network.",
          default: "",
        }),
      },
    }),
    align: field.select({
      label: "Alignment",
      options: ["left", "center", "right"],
      default: "left",
    }),
  },
  render: ({ title, items, align }) => {
    const links = items
      .map((item) => ({ ...item, href: socialHref(item.network, item.href) }))
      .filter((item) => item.href !== null);

    if (links.length === 0) return null;

    return (
      <div className="mn-social" data-align={align}>
        {title ? <h2 className="mn-social-title">{title}</h2> : null}
        <ul className="mn-social-row">
          {links.map((item, index) => (
            // eslint-disable-next-line react/no-array-index-key
            <li key={index}>
              <a
                className="mn-social-link"
                data-network={item.network}
                href={item.href!}
                {...(item.href!.startsWith("http")
                  ? { target: "_blank", rel: "me noreferrer" }
                  : {})}
              >
                {item.label || SOCIAL_NAMES[item.network] || item.network}
              </a>
            </li>
          ))}
        </ul>
      </div>
    );
  },
});

/**
 * Two or more buttons side by side.
 *
 * Asked for on 6 September, and the answer before this Block existed was "set the Section to
 * two Columns" -- which is the wrong answer. That puts each button at half the width of the
 * band with a gutter between them, when what a hero wants is "Book a table" and "See the
 * menu" sitting next to each other.
 *
 * Blocks inside a Column stack, always. `.mn-column` is a flex column and Blocks never
 * contain other Blocks, which is ADR-0003's rule and was not reopened for this. So this is a
 * Block rather than a Column property: the same shape as `logos` and `social`, which are
 * already repeaters laying their items out in a line, and it needs nothing from the layout
 * engine and no new concept for an Author.
 *
 * **Each button carries its own style rather than the Block carrying a variant**, and that
 * is the point of the Block. A hero wants one solid button and one outline beside it; a
 * Block-level variant would make every button in the row the same and leave the pair looking
 * like a mistake. `data-style` on the button is the mechanism already used by the call to
 * action, a pricing plan and the comparison table -- see the note above `.mn-btn[data-style]`
 * in blocks.css -- so this needed no new CSS mechanism either.
 */
export const buttonRowBlock = defineBlock({
  name: "buttons",
  label: "Button row",
  fields: {
    align: field.select({
      label: "Alignment",
      options: ["start", "center", "end"],
      default: "start",
    }),
    size: field.select({ label: "Size", options: ["medium", "large"], default: "medium" }),
    items: field.repeater({
      label: "Buttons",
      fields: {
        label: field.text({ label: "Label", default: "" }),
        href: field.text({ label: "Links to", default: "/" }),
        style: field.select({
          label: "Style",
          options: ["primary", "accent", "outline"],
          default: "primary",
        }),
        panelHeading: field.text({ label: "Panel heading", default: "" }),
        panelBody: field.textarea({
          label: "Panel text",
          help: "Fill this in and this button opens a panel instead of following its link.",
          default: "",
        }),
        panelImage: field.image({ label: "Panel picture", help: "Optional" }),
      },
    }),
  },
  render: ({ align, size, items }, context, meta) => {
    // A button with no label is a link nobody can see or click, which is what an Author
    // leaves behind when they add a row item and change their mind. The same filter the
    // logo strip and the social row apply to their own empty items.
    const shown = items.filter((item) => item.label);
    if (shown.length === 0) return null;

    return (
      <div className="mn-buttons" data-align={align}>
        {shown.map((item, index) => {
          const panel = { heading: item.panelHeading, body: item.panelBody };

          // Each button in the row gets its own panel, so a hero can have "Book a table"
          // going to the booking page beside "See the menu" opening one. The id is the
          // Block's own plus the position, which is unique on the Page because the Block id
          // is -- the same reasoning as the single button, one level down.
          if (hasPanel(panel)) {
            const toggleId = `mn-pop-${meta.id}-${index}`;
            return (
              // eslint-disable-next-line react/no-array-index-key
              <span className="mn-buttons-item" key={index}>
                <input
                  type="checkbox"
                  id={toggleId}
                  className="mn-popover-toggle"
                  aria-label={
                    item.panelHeading ? `${item.label}: ${item.panelHeading}` : item.label
                  }
                />
                <label
                  htmlFor={toggleId}
                  className="mn-btn"
                  data-style={item.style}
                  data-size={size}
                  aria-hidden="true"
                >
                  {item.label}
                </label>
                <PopoverPanel
                  id={toggleId}
                  heading={item.panelHeading}
                  body={item.panelBody}
                  image={item.panelImage}
                  context={context}
                />
              </span>
            );
          }

          return (
            // eslint-disable-next-line react/no-array-index-key
            <a
              key={index}
              className="mn-btn"
              data-style={item.style}
              data-size={size}
              // Author input that becomes an href, so it goes through the same check every
              // other Block with a link uses. React refuses `javascript:` on its own and does
              // not refuse `vbscript:` -- see the note in carousel.test.tsx.
              href={safeHref(item.href) || "/"}
            >
              {item.label}
            </a>
          );
        })}
      </div>
    );
  },
});


/**
 * A list of things that open a panel: a biography, what a service includes, the story behind
 * a photograph.
 *
 * **Built on `:target`, like the gallery's lightbox, and for the same reason.** No
 * JavaScript is involved, so a panel opens before hydration, opens with a blocked script,
 * and is keyboard operable without anybody implementing that -- the trigger is a link and
 * every browser already knows what to do with one. A popover built the usual way is a button
 * with `aria-expanded`, a click handler, an Escape listener and a focus trap, and it is none
 * of those things until its script arrives.
 *
 * The trade is honest and worth stating: `:target` puts the open panel in the address bar,
 * so opening one adds a history entry and Back closes it. That is the behaviour the gallery
 * already has on this Site, and a shared link opens the panel it names, which for a
 * biography is a feature.
 *
 * A **Block rather than a field on the button**, which was M10.5's open question. A field
 * would let any button anywhere open a panel and is genuinely more useful, but it needs ids
 * unique across a whole Page rather than within one Block, every adopting Block Type to
 * render panel markup, and the Editor to generate a nested form for a field that is really a
 * small document. The case that actually comes up -- a team page, a service list -- is a
 * list, and a list is what `logos`, `social` and this all are. It is the same argument that
 * kept the button row a Block instead of a Column property.
 *
 * The panel is rendered whether or not it is open. It is a `<div>` hidden with `display:
 * none` until it is the fragment, so its text is in the document for in-page search and for
 * anything reading the Page without CSS -- and, unlike a JavaScript panel, it is in the
 * markup a crawler sees.
 */
export const popoversBlock = defineBlock({
  name: "popovers",
  label: "Popovers",
  fields: {
    title: field.text({ label: "Title", default: "" }),
    items: field.repeater({
      label: "Panels",
      fields: {
        trigger: field.text({ label: "Link text", default: "" }),
        heading: field.text({ label: "Panel heading", default: "" }),
        body: field.textarea({
          label: "Panel text",
          help: "Markdown. # for a heading, - for a list, [text](address) for a link.",
          default: "",
        }),
        image: field.image({ label: "Picture", help: "Optional" }),
      },
    }),
  },
  render: ({ title, items }, context, meta) => {
    // An item with nothing to click on is not a popover. The same filter the logo strip and
    // the button row apply to their own half-finished items.
    const shown = items.filter((item) => item.trigger);
    if (shown.length === 0) return null;

    // Derived from the content, exactly as the gallery and carousel derive theirs, so two
    // popover Blocks on one Page do not share fragment ids and open each other's panels.
    // The Block's own id rather than a hash of its content. The hash was unique in
    // practice and not in principle -- two popover Blocks holding the same people would
    // have minted the same ids and opened each other's panels. `meta` exists for this.
    const scope = meta.id;

    return (
      <div className="mn-popovers" id={`mn-pop-${scope}`}>
        {title ? <h2 className="mn-popovers-title">{title}</h2> : null}

        <ul className="mn-popover-triggers">
          {shown.map((item, index) => {
            const toggleId = `mn-pop-${scope}-${index}`;

            return (
              // eslint-disable-next-line react/no-array-index-key
              <li key={index}>
                {/* The checkbox is the control a keyboard reaches, so the name belongs on
                    it -- the same division the mobile nav drawer makes, and the same reason:
                    the label is the thing a thumb hits and carries no meaning of its own. */}
                <input
                  type="checkbox"
                  id={toggleId}
                  className="mn-popover-toggle"
                  aria-label={item.heading ? `${item.trigger}: ${item.heading}` : item.trigger}
                />
                <label htmlFor={toggleId} className="mn-popover-open" aria-hidden="true">
                  {item.trigger}
                </label>

                <PopoverPanel
                  id={toggleId}
                  heading={item.heading}
                  body={item.body}
                  image={item.image}
                  context={context}
                />
              </li>
            );
          })}
        </ul>
      </div>
    );
  },
});


export const designBlocks = [
  eyebrowBlock,
  buttonBlock,
  buttonRowBlock,
  featuresBlock,
  statsBlock,
  testimonialBlock,
  logosBlock,
  ctaBlock,
  pricingBlock,
  accordionBlock,
  galleryBlock,
  carouselBlock,
  mapBlock,
  embedBlock,
  compareBlock,
  socialBlock,
  popoversBlock,
];
