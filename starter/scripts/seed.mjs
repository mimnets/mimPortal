#!/usr/bin/env node
/**
 * Builds the demo Site a fresh clone opens on: a landing page, an about page and a contact
 * page, sharing a Header, a Footer and one Menu.
 *
 * It exists to answer one question — "what does a Site built out of these Blocks actually
 * look like?" — so it uses the composition Blocks and the Section tones rather than the
 * minimum needed to prove the renderer runs. Nothing in the product depends on it.
 *
 * Re-runnable. It replaces the layout of the Pages it owns and leaves everything else alone.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import "dotenv/config";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Run `pnpm setup` first.");
  process.exit(1);
}

/* ---- Seeded media -------------------------------------------------------- */

/**
 * The demo's images are generated SVGs rather than photographs, for two reasons: nothing has
 * to be licensed, and every one of them is drawn from the Theme's own palette, so changing
 * `theme.ts` changes the artwork too. They are written into the media library as real files,
 * which is the same path an Author's own uploads take.
 */
const INK = "#0c1f21";
const JADE = "#0b6b62";
const EMBER = "#e05a26";

/**
 * The hero backdrop.
 *
 * It is used as a CSS background with `cover`, which crops it to whatever shape the band
 * ends up being — so the composition has to survive being cut anywhere. Big blocks do not:
 * an earlier version put a wide stripe across the middle and the crop turned it into a
 * brown bar that read as a rendering fault. A wash plus thin rules crops cleanly at any size.
 */
const heroSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="600" viewBox="0 0 1600 600">
  <defs>
    <radialGradient id="glow" cx="0.72" cy="0.15" r="0.85">
      <stop offset="0" stop-color="${JADE}" stop-opacity="0.75"/>
      <stop offset="1" stop-color="${JADE}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1600" height="600" fill="${INK}"/>
  <rect width="1600" height="600" fill="url(#glow)"/>
  <g stroke="#ffffff" stroke-opacity="0.07" stroke-width="1">
    ${Array.from({ length: 16 }, (_, i) => `<line x1="${i * 100}" y1="0" x2="${i * 100}" y2="600"/>`).join("\n    ")}
  </g>
  <g stroke="${EMBER}" stroke-opacity="0.55" stroke-width="3">
    <line x1="0" y1="150" x2="1600" y2="150"/>
    <line x1="0" y1="452" x2="1600" y2="452"/>
  </g>
</svg>`;

/** A wordmark, for the logo strip. Flat, monochrome, so the strip reads as a set. */
const wordmark = (label) => `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="60" viewBox="0 0 240 60">
  <rect width="240" height="60" fill="none"/>
  <circle cx="30" cy="30" r="14" fill="${INK}"/>
  <text x="58" y="39" font-family="Segoe UI, system-ui, sans-serif" font-size="24"
        font-weight="700" fill="${INK}">${label}</text>
</svg>`;

/** An avatar, for a testimonial. Initials on a tinted disc. */
const avatar = (initials, fill) => `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
  <circle cx="60" cy="60" r="60" fill="${fill}"/>
  <text x="60" y="76" text-anchor="middle" font-family="Segoe UI, system-ui, sans-serif"
        font-size="44" font-weight="600" fill="#ffffff">${initials}</text>
</svg>`;

const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420">
  <rect width="640" height="420" fill="#eef3f2"/>
  <text x="320" y="220" text-anchor="middle" font-family="Segoe UI, system-ui, sans-serif"
        font-size="26" fill="${JADE}">image Block</text>
</svg>`;

/** Fixed keys, so re-running replaces the demo artwork instead of piling up copies of it. */
const MEDIA = [
  ["seed/hero.svg", heroSvg, "Overlapping horizontal bands"],
  ["seed/placeholder.svg", placeholderSvg, "A placeholder image"],
  ["seed/logo-northwind.svg", wordmark("Northwind"), "Northwind"],
  ["seed/logo-fathom.svg", wordmark("Fathom"), "Fathom"],
  ["seed/logo-meridian.svg", wordmark("Meridian"), "Meridian"],
  ["seed/logo-arbor.svg", wordmark("Arbor"), "Arbor"],
  ["seed/avatar-rk.svg", avatar("RK", JADE), "Rina Kaur"],
  ["seed/avatar-tm.svg", avatar("TM", EMBER), "Tomas Molina"],
];

async function seedMedia(sql) {
  // Only the local-disk default can be written to from a script. A Site already on a bucket
  // keeps whatever is there — a seed has no business reaching into a client's storage.
  if (process.env.S3_BUCKET) {
    console.log("Storage is a bucket — leaving the media library alone.");
    return;
  }

  const directory = resolve(process.env.MEDIA_DIR ?? ".media");

  for (const [key, svg, alt] of MEDIA) {
    const file = join(directory, key);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, svg, "utf8");

    await sql`
      insert into media (key, filename, content_type, size, width, height, alt)
      values (${key}, ${key.split("/").pop()}, 'image/svg+xml',
              ${Buffer.byteLength(svg)}, null, null, ${alt})
      on conflict (key) do update set size = excluded.size, alt = excluded.alt
    `;
  }

  console.log(`Seeded ${MEDIA.length} images`);
}

/* ---- Layout helpers ------------------------------------------------------ */

const id = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const block = (type, props) => ({ id: id("blk"), type, props });

const emptyImage = () => ({ key: "", alt: "", width: null, height: null });
const image = (key, alt) => ({ key, alt, width: null, height: null });

const column = (blocks) => ({ id: id("col"), blocks });

/**
 * A Section, with the paint on it. `tone` is what turns a stack of content into a page that
 * looks composed — it is the Section's job rather than a Block's, because a Section is the
 * only thing here that spans the full width.
 */
const section = (layout, columns, options = {}) => ({
  id: id("sec"),
  layout,
  columns,
  tone: options.tone ?? "default",
  padding: options.padding ?? "normal",
  background: options.background ?? { key: "", overlay: 0.45 },
});

/**
 * Headers and Footers are shared rows, not per-Page copies.
 *
 * Each Page points at one, so editing it changes every Page using it — which is what a
 * Header is for, and what this Site claimed to do long before it was true. Two of each are
 * seeded so a Site starts with an actual choice rather than one arrangement and a blank.
 */
const SHARED_SLOTS = [
  {
    slug: "main-header",
    name: "Main header",
    slot: "header",
    sections: [
      section("2-1", [
        column([block("logo", { image: emptyImage(), text: "", href: "/" })]),
        column([block("menu", { slug: "main", align: "end" })]),
      ]),
    ],
  },
  {
    slug: "centred-header",
    name: "Centred header",
    slot: "header",
    sections: [
      section("1", [
        column([
          block("logo", { image: emptyImage(), text: "", href: "/" }),
          block("menu", { slug: "main", align: "center" }),
        ]),
      ]),
    ],
  },
  {
    slug: "main-footer",
    name: "Main footer",
    slot: "footer",
    sections: [
      section(
        "2-1",
        [
          column([block("text", { body: "© Mimnets — one Footer, shared by every Page." })]),
          column([block("menu", { slug: "main", align: "end" })]),
        ],
        { tone: "surface" },
      ),
    ],
  },
  {
    slug: "simple-footer",
    name: "Simple footer",
    slot: "footer",
    sections: [
      section("1", [column([block("text", { body: "© Mimnets" })])], { tone: "surface" }),
    ],
  },
];

async function seedSharedSlots(sql) {
  const ids = {};
  for (const entry of SHARED_SLOTS) {
    const [row] = await sql`
      insert into shared_slots (slug, name, slot, sections)
      values (${entry.slug}, ${entry.name}, ${entry.slot}, ${sql.json(entry.sections)})
      on conflict (slug) do update
        set name = excluded.name, sections = excluded.sections, updated_at = now()
      returning id, slug
    `;
    ids[row.slug] = row.id;
  }
  console.log(`Seeded ${SHARED_SLOTS.length} shared Headers and Footers`);
  return ids;
}

/**
 * A Page holds Main and Sidebar. Its Header and Footer come from a shared Slot, so the
 * layout document keeps those two empty — the Page has nothing of its own to store there
 * until somebody chooses "This Page only".
 */
function page(title, path, main) {
  return {
    title,
    path,
    layout: { version: 1, slots: { header: [], main, sidebar: [], footer: [] } },
  };
}

/* ---- The Pages ----------------------------------------------------------- */

const pages = [
  page("Home", "/", [
    // The hero is a band with a photograph behind it, which is the one place a Page is
    // allowed to be loud.
    section(
      "1",
      [
        column([
          block("eyebrow", { text: "A page builder that stays out of the way" }),
          block("heading", { text: "A Page is a tree, not a canvas", level: "h1", align: "left" }),
          block("text", {
            body:
              "Slots hold Sections, Sections hold Columns, Columns hold Blocks. Nothing floats, " +
              "nothing overlaps, and nothing a client drags can break the layout.",
          }),
          block("button", { label: "See how it works", href: "/about", style: "accent", size: "large" }),
        ]),
      ],
      { padding: "large", background: { key: "seed/hero.svg", overlay: 0.5 } },
    ),

    section("1", [
      column([
        block("logos", {
          title: "Built for the people who hand sites over",
          muted: true,
          items: [
            { image: image("seed/logo-northwind.svg", "Northwind") },
            { image: image("seed/logo-fathom.svg", "Fathom") },
            { image: image("seed/logo-meridian.svg", "Meridian") },
            { image: image("seed/logo-arbor.svg", "Arbor") },
          ],
        }),
      ]),
    ]),

    section("1", [
      column([
        block("eyebrow", { text: "Why it holds up" }),
        block("heading", { text: "Constraints your client cannot break", level: "h2", align: "left" }),
        block("features", {
          columns: "3",
          items: [
            {
              icon: "🧱",
              title: "Structure, not positioning",
              body: "Blocks sit in Columns inside Sections. There is no free canvas, so there is no dragging something into a mess.",
            },
            {
              icon: "🔒",
              title: "Locked regions",
              body: "The Header and Footer are locked to Authors, and the server re-checks every save. Hiding a button is a courtesy, not a permission.",
            },
            {
              icon: "🎨",
              title: "One file rebrands it",
              body: "Every Block is styled against Theme tokens. Change theme.ts and the whole Site changes with it.",
            },
            {
              icon: "📝",
              title: "Draft and publish",
              body: "Edits stay invisible until published, every publish is snapshotted, and any version restores into the draft.",
            },
            {
              icon: "🖼️",
              title: "Real uploads",
              body: "A media library on disk or in a bucket. A layout stores keys, never URLs, so moving hosts changes nothing on a Page.",
            },
            {
              icon: "✉️",
              title: "Forms that arrive",
              body: "Enquiries are stored before they are emailed, so a mail server having a bad day never costs you a customer.",
            },
          ],
        }),
      ]),
    ]),

    // The primary band. One saturated stripe down a long page does more than colouring
    // everything, which is the argument for tones being per-Section.
    section(
      "1",
      [
        column([
          block("stats", {
            items: [
              { value: "4", label: "Slots on every Page" },
              { value: "14", label: "Block Types included" },
              { value: "1", label: "File that rebrands a Site" },
              { value: "0", label: "Ways to break the grid" },
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
          block("heading", { text: "What people say after the handover", level: "h2", align: "left" }),
          block("testimonial", {
            items: [
              {
                quote:
                  "I stopped getting calls asking me to move a photo. They just move it, and the page still looks like the one I designed.",
                name: "Rina Kaur",
                role: "Freelance designer",
                image: image("seed/avatar-rk.svg", ""),
              },
              {
                quote:
                  "We handed the site to the client's office manager on a Friday. Nothing broke, and I have not had to log in since.",
                name: "Tomas Molina",
                role: "Studio owner",
                image: image("seed/avatar-tm.svg", ""),
              },
            ],
          }),
        ]),
      ],
      { tone: "surface" },
    ),

    section(
      "1",
      [
        column([
          block("cta", {
            heading: "Hand a client a site you will not be maintaining",
            body: "Clone the Starter, change six values, and give somebody the keys.",
            buttonLabel: "Get in touch",
            buttonHref: "/contact",
            align: "center",
          }),
        ]),
      ],
      { tone: "dark", padding: "large" },
    ),
  ]),

  page("About", "/about", [
    section("1", [
      column([
        block("eyebrow", { text: "About" }),
        block("heading", { text: "Built around what clients actually do", level: "h1", align: "left" }),
        block("text", {
          body:
            "Most page builders fail at the handover. They give a client a canvas, the client drags " +
            "something, and the designer gets a call.\n\nThis one gives them a tree. Every Page is a " +
            "validated document, every region is typed, and the parts you do not want touched are " +
            "locked on the server rather than hidden in the interface.",
        }),
      ]),
    ]),

    section(
      "1-1",
      [
        column([
          block("heading", { text: "What an Author can change", level: "h3", align: "left" }),
          block("text", {
            body: "Content, images, the order of Blocks, and the Pages they have been given.",
          }),
        ]),
        column([
          block("heading", { text: "What they cannot", level: "h3", align: "left" }),
          block("text", {
            body: "The Header, the Footer, the Theme, the code, or the structure of the Site.",
          }),
        ]),
      ],
      { tone: "surface" },
    ),

    section("1-1-1", [
      column([block("heading", { text: "Slots", level: "h3", align: "left" }), block("text", { body: "Header, Main, Sidebar, Footer. Named regions of a Page." })]),
      column([block("heading", { text: "Sections", level: "h3", align: "left" }), block("text", { body: "Full-width bands, each divided into one to four Columns." })]),
      column([block("heading", { text: "Blocks", level: "h3", align: "left" }), block("text", { body: "The content itself, ordered inside a Column." })]),
    ]),

    section(
      "1",
      [
        column([
          block("cta", {
            heading: "Read the decisions behind it",
            body: "Twelve ADRs record what was rejected and why, including the free-positioning canvas.",
            buttonLabel: "Talk to us",
            buttonHref: "/contact",
            align: "center",
          }),
        ]),
      ],
      { tone: "primary" },
    ),
  ]),

  page("Contact", "/contact", [
    section("1", [
      column([
        block("eyebrow", { text: "Contact" }),
        block("heading", { text: "Tell us about the site", level: "h1", align: "left" }),
      ]),
    ]),

    section("2-1", [
      column([
        block("contact", {
          heading: "",
          intro: "This form works with JavaScript switched off. Every message is stored in the Dashboard whether or not the notification email goes out.",
          // Empty, so it falls back to CONTACT_RECIPIENT rather than seeding an address
          // that belongs to whoever cloned this.
          recipient: "",
          buttonLabel: "Send message",
          successMessage: "Thank you — we will reply within a working day.",
          slug: "contact",
        }),
      ]),
      column([
        block("heading", { text: "What happens next", level: "h3", align: "left" }),
        block("text", {
          body:
            "We read everything that comes through here.\n\nIf you are evaluating this for a client " +
            "project, say so — the answer is usually a short call rather than a proposal.",
        }),
      ]),
    ]),
  ]),
];

/* ---- Write it ------------------------------------------------------------ */

const sql = postgres(url, { max: 1 });

try {
  await seedMedia(sql);
  const slotIds = await seedSharedSlots(sql);

  await sql`
    insert into menus (slug, name, items)
    values ('main', 'Main navigation', ${sql.json([
      { id: "nav-home", label: "Home", href: "/", newTab: false },
      { id: "nav-about", label: "About", href: "/about", newTab: false },
      { id: "nav-contact", label: "Contact", href: "/contact", newTab: false },
    ])})
    on conflict (slug) do update set items = excluded.items, updated_at = now()
  `;

  for (const entry of pages) {
    // Seeded Pages are published, because a Page nobody published is not visible and the
    // point of the seed is to have something to look at.
    const [row] = await sql`
      insert into pages (path, title, locale, draft_layout, published_layout,
                         header_slot_id, footer_slot_id)
      values (${entry.path}, ${entry.title}, 'en', ${sql.json(entry.layout)}, ${sql.json(entry.layout)},
              ${slotIds["main-header"]}, ${slotIds["main-footer"]})
      on conflict (path, locale) do update
        set title = excluded.title,
            draft_layout = excluded.draft_layout,
            published_layout = excluded.published_layout,
            header_slot_id = excluded.header_slot_id,
            footer_slot_id = excluded.footer_slot_id,
            updated_at = now()
      returning path
    `;
    console.log(`Seeded ${row.path}`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
