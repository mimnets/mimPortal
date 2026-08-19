#!/usr/bin/env node
/**
 * Builds a small three-Page Site: a Header with a logo and the main Menu, a Footer, and
 * enough content on each Page to see the Theme working.
 *
 * Re-runnable, and it replaces the layout of the Pages it owns. Nothing in the product
 * depends on this script — it exists so a fresh clone has something to look at.
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

/**
 * The placeholder is seeded as a real file in the media library rather than inlined as a
 * data URI, because an image Block now holds a storage key. A fresh clone therefore starts
 * with one file it can see in the Dashboard, replace, and delete — the same path an
 * Author's own uploads take.
 */
const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 420">
  <rect width="640" height="420" fill="#e8e8ee"/>
  <text x="320" y="220" text-anchor="middle" font-family="sans-serif"
        font-size="28" fill="#77778a">image block</text>
</svg>`;

// A fixed key, so re-running the seed replaces the placeholder instead of adding another.
const placeholderKey = "seed/placeholder.svg";

async function seedPlaceholder(sql) {
  // Only the local-disk default can be written to from a script; a Site already on a bucket
  // keeps whatever is there rather than having a seed reach into its storage.
  if (process.env.S3_BUCKET) {
    console.log("Storage is a bucket — leaving the media library alone.");
    return;
  }

  const directory = resolve(process.env.MEDIA_DIR ?? ".media");
  const file = join(directory, placeholderKey);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, placeholderSvg, "utf8");

  await sql`
    insert into media (key, filename, content_type, size, width, height, alt)
    values (${placeholderKey}, 'placeholder.svg', 'image/svg+xml',
            ${Buffer.byteLength(placeholderSvg)}, null, null, 'A grey placeholder')
    on conflict (key) do update set size = excluded.size
  `;
}

const id = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const block = (type, props) => ({ id: id("blk"), type, props });

const emptyImage = () => ({ key: "", alt: "", width: null, height: null });
const column = (blocks) => ({ id: id("col"), blocks });
const section = (layout, columns) => ({ id: id("sec"), layout, columns });

/** Every Page shares the same Header and Footer, which is what the Menu entity is for. */
const header = () =>
  section("2-1", [
    column([block("logo", { image: emptyImage(), text: "", href: "/" })]),
    column([block("menu", { slug: "main", align: "end" })]),
  ]);

const footer = (text) =>
  section("1", [column([block("text", { body: text })])]);

function page(title, path, main) {
  return {
    title,
    path,
    layout: {
      version: 1,
      slots: {
        header: [header()],
        main,
        sidebar: [],
        footer: [footer("© Mimnets — every Page shares this Footer and its Menu.")],
      },
    },
  };
}

const pages = [
  page("Home", "/", [
    section("2-1", [
      column([
        block("heading", { text: "A Page is a tree, not a canvas", level: "h1", align: "left" }),
        block("text", {
          body:
            "This Page is a layout document in one database column. The server reads it and " +
            "assembles what you are looking at.\n\nThe Header above is the same on every Page, " +
            "and its links come from one Menu.",
        }),
      ]),
      column([
        block("image", {
          image: { key: placeholderKey, alt: "A grey placeholder", width: null, height: null },
          caption: "Replace this from the media library in the Dashboard",
        }),
      ]),
    ]),
    section("1-1-1", [
      column([
        block("heading", { text: "Slots", level: "h3", align: "left" }),
        block("text", { body: "Header, Main, Sidebar, Footer. Named regions of a Page." }),
      ]),
      column([
        block("heading", { text: "Sections", level: "h3", align: "left" }),
        block("text", { body: "Full-width bands, each divided into one to four Columns." }),
      ]),
      column([
        block("heading", { text: "Blocks", level: "h3", align: "left" }),
        block("text", { body: "The content itself, ordered inside a Column." }),
      ]),
    ]),
  ]),

  page("About", "/about", [
    section("1", [
      column([
        block("heading", { text: "About", level: "h1", align: "left" }),
        block("text", {
          body:
            "A second Page, served by the same catch-all route and rendered from its own " +
            "layout document.\n\nThe navigation marks whichever Page you are on.",
        }),
      ]),
    ]),
  ]),

  page("Contact", "/contact", [
    section("1", [
      column([
        block("heading", { text: "Contact", level: "h1", align: "center" }),
        block("text", {
          body:
            "This form works with JavaScript switched off. Submissions are stored in the " +
            "Dashboard whether or not the notification email goes out.",
        }),
        block("contact", {
          heading: "Get in touch",
          intro: "",
          // Empty, so it falls back to CONTACT_RECIPIENT rather than seeding an address
          // that belongs to whoever cloned this.
          recipient: "",
          buttonLabel: "Send",
          successMessage: "Thank you — your message has been sent.",
          slug: "contact",
        }),
      ]),
    ]),
  ]),
];

const sql = postgres(url, { max: 1 });

try {
  await seedPlaceholder(sql);

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
      insert into pages (path, title, locale, draft_layout, published_layout)
      values (${entry.path}, ${entry.title}, 'en', ${sql.json(entry.layout)}, ${sql.json(entry.layout)})
      on conflict (path, locale) do update
        set title = excluded.title,
            draft_layout = excluded.draft_layout,
            published_layout = excluded.published_layout,
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
