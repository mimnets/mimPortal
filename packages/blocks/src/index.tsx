import { defineBlock, field, FORM_FIELDS, FORM_RESULT_PARAM } from "@mimnets/core";

import { designBlocks } from "./design";

export * from "./design";

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

/**
 * A contact form that works before any JavaScript has loaded.
 *
 * It is a plain <form method="post"> that posts to a route and redirects back, for the same
 * reason the mobile drawer is a checkbox: an enquiry is the thing a brochure Site exists to
 * produce, and it should not depend on a bundle having arrived. That constraint is also what
 * makes the result message a query parameter rather than component state.
 *
 * The spam protection a visitor meets is nothing: a hidden field they cannot see, and a
 * check that they took more than two seconds. There is no CAPTCHA, and adding one is a
 * change to `lib/spam.ts` rather than to this markup.
 */
export const contactBlock = defineBlock({
  name: "contact",
  label: "Contact form",
  fields: {
    heading: field.text({ label: "Heading", default: "Get in touch" }),
    intro: field.textarea({ label: "Intro", default: "" }),
    recipient: field.text({
      label: "Send enquiries to",
      help: "Leave empty to use the Site's own address.",
      default: "",
    }),
    buttonLabel: field.text({ label: "Button", default: "Send" }),
    successMessage: field.text({
      label: "Thank-you message",
      default: "Thank you — your message has been sent.",
    }),
    slug: field.text({
      label: "Form name",
      help: "Groups submissions in the Dashboard. Use one per form.",
      default: "contact",
    }),
  },
  // `recipient` is deliberately absent from this signature. It is a field an Author sets and
  // the form route reads back from the published Block by `slug`; putting it in the markup as
  // a hidden input made it visitor input, and made the Site a relay for anybody's mail.
  render: ({ heading, intro, buttonLabel, successMessage, slug }, context) => {
    const result = context.query[FORM_RESULT_PARAM];

    // The result belongs to this form, not to whichever form rendered first on the Page.
    if (result === slug) {
      return (
        <div className="mn-form mn-form-done" role="status">
          {heading ? <h2 className="mn-heading">{heading}</h2> : null}
          <p>{successMessage}</p>
        </div>
      );
    }

    return (
      <form className="mn-form" method="post" action="/api/forms">
        {heading ? <h2 className="mn-heading">{heading}</h2> : null}
        {intro ? <p className="mn-form-intro">{intro}</p> : null}

        {result === `${slug}:error` ? (
          <p className="mn-form-error" role="alert">
            That message could not be sent. Please check the form and try again.
          </p>
        ) : null}

        <input type="hidden" name={FORM_FIELDS.slug} value={slug} />
        <input type="hidden" name={FORM_FIELDS.renderedAt} value={context.formToken} />
        <input type="hidden" name={FORM_FIELDS.returnTo} value={context.currentPath} />

        {/* The bait. Positioned off-screen rather than display:none, because some bots skip
            what is explicitly hidden, and hidden from assistive technology and the tab order
            so no person is ever offered it. */}
        <div className="mn-form-trap" aria-hidden="true">
          <label>
            Website
            <input type="text" name={FORM_FIELDS.honeypot} tabIndex={-1} autoComplete="off" />
          </label>
        </div>

        <label className="mn-form-field">
          <span>Your name</span>
          <input type="text" name="name" required autoComplete="name" />
        </label>

        <label className="mn-form-field">
          <span>Your email</span>
          <input type="email" name="email" required autoComplete="email" />
        </label>

        <label className="mn-form-field">
          <span>Message</span>
          <textarea name="message" rows={6} required />
        </label>

        <button type="submit" className="mn-form-submit">
          {buttonLabel || "Send"}
        </button>
      </form>
    );
  },
});

/** Registered by a Site in its blocks.config.ts, alongside any Blocks of its own. */
export const standardBlocks = [
  // Content first, composition second: this is the order they appear in the Editor picker,
  // and an Author reaches for a heading far more often than for a pricing plan.
  headingBlock,
  textBlock,
  imageBlock,
  ...designBlocks,
  logoBlock,
  menuBlock,
  contactBlock,
];
