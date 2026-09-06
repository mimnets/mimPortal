import type { ThemeInput } from "@mimnets/core";

/**
 * Designs that ship with the Starter, ready to apply.
 *
 * The counterpart to a generated Preset rather than a replacement for it. Generation is
 * unlimited but takes a minute, needs a key, and varies in quality; these are instant, free,
 * need no provider at all, and look the way somebody intended. Most Sites want one of these
 * and then a few edits.
 *
 * They are data, not code, and they go through exactly the same validation an AI-generated
 * Preset does — `presets.test.ts` parses every one of them against the registry, so a
 * built-in design that references a Block this Site does not have fails the build rather
 * than a client's first click.
 *
 * Sections carry no ids. They are assigned when the Preset is applied, for the same reason
 * generated ones are: two Pages holding Blocks with the same id would confuse the Editor,
 * which addresses Blocks by id.
 */

export interface BuiltInPreset {
  slug: string;
  name: string;
  /** Grouped in the Dashboard, so an Owner can find the one for their client's trade. */
  category: string;
  description: string;
  theme: ThemeInput;
  pages: { title: string; path: string; sections: unknown[] }[];
}

/* ---- Small helpers, so the designs below read as designs ------------------ */

const block = (
  type: string,
  props: Record<string, unknown>,
  style?: Record<string, unknown>,
) => (style ? { type, props, style } : { type, props });
const column = (blocks: unknown[]) => ({ blocks });

const section = (
  layout: string,
  columns: unknown[],
  options: { tone?: string; padding?: string } = {},
) => ({
  layout,
  columns,
  tone: options.tone ?? "default",
  padding: options.padding ?? "normal",
  background: { key: "", overlay: 0.45 },
});

const heading = (text: string, level = "h2", align = "left") =>
  block("heading", { text, level, align });
const text = (body: string) => block("text", { body });
const eyebrow = (t: string) => block("eyebrow", { text: t });
/**
 * A button's look is a variant, and these designs state it as one.
 *
 * They wrote `props.style` until now, which the registry still lifts across for the
 * Pages already stored on real Sites. But these are new documents, minted every time
 * somebody applies a design, and writing them in the shape the migration exists to
 * rescue is what would have kept `variantWasField` alive forever.
 */
const button = (label: string, href: string, variant = "primary", size = "medium") =>
  block("button", { label, href, size }, { variant });

const cta = (h: string, body: string, label: string, href = "/contact") =>
  block("cta", { heading: h, body, buttonLabel: label, buttonHref: href, align: "center" });

const contactForm = (intro: string) =>
  block("contact", {
    heading: "",
    intro,
    recipient: "",
    buttonLabel: "Send message",
    successMessage: "Thank you — we will reply within one working day.",
    slug: "contact",
  });

/* ---- 1. Chambers — professional services --------------------------------- */

const chambers: BuiltInPreset = {
  slug: "chambers",
  name: "Chambers",
  category: "Professional services",
  description:
    "Restrained and formal, for a practice that expects to be taken at its word. Deep navy, brass, and a serif that does not shout.",
  theme: {
    colors: {
      background: "#ffffff",
      surface: "#f2f4f7",
      text: "#121a2b",
      muted: "#5c6880",
      primary: "#16243f",
      accent: "#b0813b",
      border: "#dde2ea",
    },
    fonts: {
      heading: 'Georgia, "Iowan Old Style", "Times New Roman", serif',
      body: '"Segoe UI", system-ui, -apple-system, sans-serif',
    },
    radius: { base: "3px" },
    spacing: { section: "5rem", gutter: "3rem" },
    measure: "68rem",
  },
  pages: [
    {
      title: "Home",
      path: "/",
      sections: [
        section(
          "1",
          [
            column([
              eyebrow("Established 1994"),
              heading("Advice you can act on", "h1"),
              text(
                "We act for families and owner-managed businesses across the region. Clear terms, a named solicitor, and an answer when you call.",
              ),
              button("Arrange a consultation", "/contact", "accent", "large"),
            ]),
          ],
          { tone: "dark", padding: "large" },
        ),

        section("1", [
          column([
            eyebrow("What we do"),
            heading("Four practice areas"),
            block("features", {
              columns: "2",
              items: [
                {
                  icon: "⚖️",
                  title: "Family law",
                  body: "Separation, children arrangements and financial settlements, handled without escalation where escalation is avoidable.",
                },
                {
                  icon: "🏠",
                  title: "Property",
                  body: "Residential and commercial conveyancing, leases and boundary disputes, with fixed fees quoted before we start.",
                },
                {
                  icon: "📄",
                  title: "Wills and probate",
                  body: "Wills, lasting powers of attorney, and estate administration for families who would rather it were settled properly.",
                },
                {
                  icon: "🏢",
                  title: "Business",
                  body: "Shareholder agreements, commercial contracts and disputes for companies that do not have their own legal team.",
                },
              ],
            }),
          ]),
        ]),

        section(
          "1",
          [
            column([
              block("stats", {
                items: [
                  { value: "30", label: "Years in practice" },
                  { value: "6", label: "Solicitors" },
                  { value: "1", label: "Named contact per matter" },
                  { value: "48h", label: "Maximum reply time" },
                ],
              }),
            ]),
          ],
          { tone: "primary" },
        ),

        section(
          "1",
          [
            column([
              heading("What clients say"),
              block("testimonial", {
                items: [
                  {
                    quote:
                      "They told me at the outset what it would cost and what it would not achieve. Nobody had done that before.",
                    name: "Helen Ward",
                    role: "Client, family matter",
                    image: { key: "", alt: "", width: null, height: null },
                  },
                  {
                    quote:
                      "Our lease renewal was handled in three weeks. I spoke to the same person every time I rang.",
                    name: "Idris Mahmood",
                    role: "Director, Fenwick Joinery",
                    image: { key: "", alt: "", width: null, height: null },
                  },
                ],
              }),
            ]),
          ],
          { tone: "surface" },
        ),

        section(
          "1",
          [column([cta("Speak to a solicitor", "First conversation, thirty minutes, no charge.", "Arrange a consultation")])],
          { tone: "dark", padding: "large" },
        ),
      ],
    },
    {
      title: "Contact",
      path: "/contact",
      sections: [
        section("1", [column([eyebrow("Contact"), heading("Tell us what has happened", "h1")])]),
        section("2-1", [
          column([contactForm("We read everything that comes through here. If it is urgent, say so and we will call.")]),
          column([
            heading("Before you write", "h3"),
            text(
              "Do not send documents yet — we will tell you which ones we need.\n\nIf your matter is already with another firm, mention that too. It changes what we can do.",
            ),
          ]),
        ]),
      ],
    },
  ],
};

/* ---- 2. Larder — hospitality and food ------------------------------------ */

const larder: BuiltInPreset = {
  slug: "larder",
  name: "Larder",
  category: "Food and hospitality",
  description:
    "Warm and unfussy, for a kitchen that would rather show the food than talk about it. Deep olive, amber, generous spacing.",
  theme: {
    colors: {
      background: "#fbf8f2",
      surface: "#f2ecdf",
      text: "#22271b",
      muted: "#6b7060",
      primary: "#2e3a22",
      accent: "#d08a1e",
      border: "#e3dccc",
    },
    fonts: {
      heading: '"Palatino Linotype", Palatino, Georgia, serif',
      body: '"Segoe UI", system-ui, -apple-system, sans-serif',
    },
    radius: { base: "14px" },
    spacing: { section: "5.5rem", gutter: "2.5rem" },
    measure: "70rem",
  },
  pages: [
    {
      title: "Home",
      path: "/",
      sections: [
        section(
          "1",
          [
            column([
              eyebrow("Open Wednesday to Sunday"),
              heading("Cooked over fire, most of it", "h1"),
              text(
                "A short menu that changes when the market does. Twenty-four covers, one room, and a wine list chosen by the person who pours it.",
              ),
              button("Book a table", "/contact", "accent", "large"),
            ]),
          ],
          { tone: "dark", padding: "large" },
        ),

        section("1-1", [
          column([
            eyebrow("The room"),
            heading("Small on purpose"),
            text(
              "Twenty-four seats means we cook everything to order and nothing sits under a lamp. It also means booking ahead is worth doing.",
            ),
          ]),
          column([
            eyebrow("The menu"),
            heading("Written each morning"),
            text(
              "Five starters, five mains, three puddings. If something ran out at lunch, it will not be on it at dinner.",
            ),
          ]),
        ]),

        section(
          "1",
          [
            column([
              block("stats", {
                items: [
                  { value: "24", label: "Covers" },
                  { value: "5", label: "Days a week" },
                  { value: "12", label: "Suppliers, all named" },
                  { value: "0", label: "Freezers" },
                ],
              }),
            ]),
          ],
          { tone: "primary" },
        ),

        section(
          "1",
          [
            column([
              heading("What people say"),
              block("testimonial", {
                items: [
                  {
                    quote:
                      "We asked what was good and were told what was good. It was the mackerel, and they were right.",
                    name: "Priya Anand",
                    role: "Regular since 2021",
                    image: { key: "", alt: "", width: null, height: null },
                  },
                  {
                    quote: "Booked for eight, no fuss, and they remembered the birthday without being reminded.",
                    name: "Tom Blackwood",
                    role: "Local",
                    image: { key: "", alt: "", width: null, height: null },
                  },
                ],
              }),
            ]),
          ],
          { tone: "surface" },
        ),

        section(
          "1",
          [column([cta("Book a table", "Wednesday to Sunday, from six. Sunday lunch from noon.", "Book a table")])],
          { tone: "dark", padding: "large" },
        ),
      ],
    },
    {
      title: "Contact",
      path: "/contact",
      sections: [
        section("1", [column([eyebrow("Bookings"), heading("Book a table", "h1")])]),
        section("2-1", [
          column([contactForm("Tell us the date, the time and how many of you there are. We reply the same day.")]),
          column([
            heading("Finding us", "h3"),
            text(
              "The door is the green one, beside the bakery.\n\nFor parties over eight, write rather than book online — we will find a way to seat you together.",
            ),
          ]),
        ]),
      ],
    },
  ],
};

/* ---- 3. Signal — studios, agencies and software -------------------------- */

const signal: BuiltInPreset = {
  slug: "signal",
  name: "Signal",
  category: "Studio, agency and software",
  description:
    "Bright and contemporary, for work that should look current. Indigo and coral on white, geometric type, plenty of bands.",
  theme: {
    colors: {
      background: "#ffffff",
      surface: "#f1f2fb",
      text: "#14142b",
      muted: "#5f6180",
      primary: "#4338ca",
      accent: "#f43f5e",
      border: "#e3e4f3",
    },
    fonts: {
      heading: '"Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif',
      body: '"Segoe UI", system-ui, -apple-system, sans-serif',
    },
    radius: { base: "12px" },
    spacing: { section: "4.5rem", gutter: "2.5rem" },
    measure: "74rem",
  },
  pages: [
    {
      title: "Home",
      path: "/",
      sections: [
        section(
          "1",
          [
            column([
              eyebrow("Design and build studio"),
              heading("Ship the thing, then improve it", "h1"),
              text(
                "We work in four-week blocks with one team. You get something running at the end of each, not a document about it.",
              ),
              button("Start a project", "/contact", "accent", "large"),
            ]),
          ],
          { tone: "dark", padding: "large" },
        ),

        section("1", [
          column([
            eyebrow("How we work"),
            heading("Three things, done properly"),
            block("features", {
              columns: "3",
              items: [
                {
                  icon: "🎯",
                  title: "Product design",
                  body: "Research, flows and interface work. We prototype in the browser, because a picture of a product answers different questions than a product does.",
                },
                {
                  icon: "⚙️",
                  title: "Engineering",
                  body: "TypeScript front to back. Tests where they earn their place, and a deploy pipeline you can run without us.",
                },
                {
                  icon: "📈",
                  title: "Afterwards",
                  body: "A retainer for the months that follow, or a handover thorough enough that you do not need one.",
                },
              ],
            }),
          ]),
        ]),

        section(
          "1",
          [
            column([
              block("stats", {
                items: [
                  { value: "4wk", label: "Block length" },
                  { value: "1", label: "Team, not a pool" },
                  { value: "38", label: "Projects shipped" },
                  { value: "9/10", label: "Clients return" },
                ],
              }),
            ]),
          ],
          { tone: "primary" },
        ),

        section(
          "1",
          [
            column([
              heading("What clients say"),
              block("testimonial", {
                items: [
                  {
                    quote:
                      "Four weeks in we had something our customers could use. Our last agency took four weeks to agree a plan.",
                    name: "Sara Lindqvist",
                    role: "Head of Product, Havn",
                    image: { key: "", alt: "", width: null, height: null },
                  },
                  {
                    quote: "They handed over cleanly. Our own developers picked it up in a fortnight and nothing broke.",
                    name: "Marcus Obi",
                    role: "CTO, Fieldnote",
                    image: { key: "", alt: "", width: null, height: null },
                  },
                ],
              }),
            ]),
          ],
          { tone: "surface" },
        ),

        section("1-1-1", [
          column([
            block("pricing", {
              name: "Discovery",
              price: "£6k",
              period: "block",
              featured: false,
              lines: [{ text: "Two weeks" }, { text: "Research and prototype" }, { text: "A costed plan" }],
              buttonLabel: "Enquire",
              buttonHref: "/contact",
            }),
          ]),
          column([
            block("pricing", {
              name: "Build",
              price: "£18k",
              period: "block",
              featured: true,
              lines: [
                { text: "Four weeks" },
                { text: "Design and engineering" },
                { text: "Shipped at the end" },
                { text: "Weekly demos" },
              ],
              buttonLabel: "Start here",
              buttonHref: "/contact",
            }),
          ]),
          column([
            block("pricing", {
              name: "Support",
              price: "£2.5k",
              period: "month",
              featured: false,
              lines: [{ text: "Rolling, cancel anytime" }, { text: "Fixes and small features" }, { text: "Named engineer" }],
              buttonLabel: "Enquire",
              buttonHref: "/contact",
            }),
          ]),
        ]),

        section(
          "1",
          [column([cta("Tell us what you are building", "We reply within a day, and say no when we are not the right studio.", "Start a project")])],
          { tone: "dark", padding: "large" },
        ),
      ],
    },
    {
      title: "Contact",
      path: "/contact",
      sections: [
        section("1", [column([eyebrow("Contact"), heading("Start a project", "h1")])]),
        section("2-1", [
          column([contactForm("What are you building, roughly when, and roughly what budget? Ranges are fine.")]),
          column([
            heading("What happens next", "h3"),
            text(
              "A half-hour call, usually within two days.\n\nIf we are not the right studio we will say so and suggest someone who is.",
            ),
          ]),
        ]),
      ],
    },
  ],
};

/**
 * Three to start with, deliberately across different trades. Adding a fourth is one entry in
 * this array — the Dashboard groups by `category` and the tests validate whatever is here.
 */
export const BUILT_IN_PRESETS: BuiltInPreset[] = [chambers, larder, signal];

export function presetBySlug(slug: string): BuiltInPreset | undefined {
  return BUILT_IN_PRESETS.find((preset) => preset.slug === slug);
}
