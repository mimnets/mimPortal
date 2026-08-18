#!/usr/bin/env node
/**
 * Builds a small three-Page Site: a Header with a logo and the main Menu, a Footer, and
 * enough content on each Page to see the Theme working.
 *
 * Re-runnable, and it replaces the layout of the Pages it owns. Nothing in the product
 * depends on this script — it exists so a fresh clone has something to look at.
 */
import "dotenv/config";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Run `pnpm setup` first.");
  process.exit(1);
}

const placeholder =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 420">
       <rect width="640" height="420" fill="#e8e8ee"/>
       <text x="320" y="220" text-anchor="middle" font-family="sans-serif"
             font-size="28" fill="#77778a">image block</text>
     </svg>`,
  );

const id = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const block = (type, props) => ({ id: id("blk"), type, props });
const column = (blocks) => ({ id: id("col"), blocks });
const section = (layout, columns) => ({ id: id("sec"), layout, columns });

/** Every Page shares the same Header and Footer, which is what the Menu entity is for. */
const header = () =>
  section("2-1", [
    column([block("logo", { image: { url: "", alt: "" }, text: "", href: "/" })]),
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
          image: { url: placeholder, alt: "Placeholder" },
          caption: "An image Block, until M6 makes uploads real",
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
          body: "A working contact form arrives at M6.5, with the submissions stored and emailed.",
        }),
      ]),
    ]),
  ]),
];

const sql = postgres(url, { max: 1 });

try {
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
