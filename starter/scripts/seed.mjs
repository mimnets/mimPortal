#!/usr/bin/env node
/**
 * Writes a hand-written layout document into the database, so M1 can be judged the way its
 * exit criterion says: paste JSON in by hand, see it render.
 *
 * Nothing in the product depends on this script. The Editor replaces it at M2.
 */
import "dotenv/config";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Run `pnpm setup` first.");
  process.exit(1);
}

// A tiny SVG so the image Block has something to show without reaching the network.
const placeholder =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 420">
       <rect width="640" height="420" fill="#e8e8ee"/>
       <text x="320" y="220" text-anchor="middle" font-family="sans-serif"
             font-size="28" fill="#77778a">image block</text>
     </svg>`,
  );

const layout = {
  version: 1,
  slots: {
    header: [
      {
        id: "sec-header",
        layout: "1",
        columns: [
          {
            id: "col-header",
            blocks: [
              {
                id: "blk-logo",
                type: "heading",
                props: { text: "Mimnets", level: "h3", align: "left" },
              },
            ],
          },
        ],
      },
    ],
    main: [
      {
        id: "sec-hero",
        layout: "2-1",
        columns: [
          {
            id: "col-hero-text",
            blocks: [
              {
                id: "blk-hero-heading",
                type: "heading",
                props: { text: "A Page is a tree, not a canvas", level: "h1", align: "left" },
              },
              {
                id: "blk-hero-body",
                type: "text",
                props: {
                  body:
                    "This Page was written by hand as JSON and stored in one column. " +
                    "The server read it and assembled what you are looking at.\n\n" +
                    "These two Columns sit side by side on a wide screen and stack on a " +
                    "narrow one. Nothing here was positioned; it was arranged.",
                },
              },
            ],
          },
          {
            id: "col-hero-image",
            blocks: [
              {
                id: "blk-hero-image",
                type: "image",
                props: {
                  image: { url: placeholder, alt: "Placeholder" },
                  caption: "An image Block, until M6 makes uploads real",
                },
              },
            ],
          },
        ],
      },
      {
        id: "sec-body",
        layout: "1-1-1",
        columns: [
          {
            id: "col-a",
            blocks: [
              { id: "blk-a-h", type: "heading", props: { text: "Slots", level: "h3", align: "left" } },
              {
                id: "blk-a-t",
                type: "text",
                props: { body: "Header, Main, Sidebar, Footer. Named regions of a Page." },
              },
            ],
          },
          {
            id: "col-b",
            blocks: [
              { id: "blk-b-h", type: "heading", props: { text: "Sections", level: "h3", align: "left" } },
              {
                id: "blk-b-t",
                type: "text",
                props: { body: "Full-width bands, each divided into one to four Columns." },
              },
            ],
          },
          {
            id: "col-c",
            blocks: [
              { id: "blk-c-h", type: "heading", props: { text: "Blocks", level: "h3", align: "left" } },
              {
                id: "blk-c-t",
                type: "text",
                props: { body: "The content itself, ordered inside a Column." },
              },
            ],
          },
        ],
      },
    ],
    sidebar: [],
    footer: [
      {
        id: "sec-footer",
        layout: "1",
        columns: [
          {
            id: "col-footer",
            blocks: [
              {
                id: "blk-footer",
                type: "text",
                props: { body: "M1 — layout schema, defineBlock, renderer." },
              },
            ],
          },
        ],
      },
    ],
  },
};

const sql = postgres(url, { max: 1 });

try {
  const [row] = await sql`
    insert into pages (path, title, locale, draft_layout, published_layout)
    values ('/', 'Home', 'en', ${sql.json(layout)}, ${sql.json(layout)})
    on conflict (path, locale) do update
      set draft_layout = excluded.draft_layout,
          published_layout = excluded.published_layout,
          updated_at = now()
    returning id, path
  `;
  console.log(`Seeded ${row.path} (${row.id})`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
