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
                      href={item.link.href || "/"}
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

export const designBlocks = [
  eyebrowBlock,
  buttonBlock,
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
];
