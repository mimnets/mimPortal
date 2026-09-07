/**
 * A Page that exercises all four of M10.5, for the browser check the roadmap requires.
 *
 * Not part of the seed and not shipped: this writes one Page at /m105 and makes the main
 * header sticky, so the milestone's exit criterion can be checked by looking at it rather
 * than by trusting a test. Run it, look at http://localhost:3000/m105, and delete the Page
 * afterwards if you like -- nothing else references it.
 */

import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

let counter = 0;
const id = (prefix) => `${prefix}-m105-${(counter += 1)}`;

const block = (type, props, style) =>
  style ? { id: id("blk"), type, props, style } : { id: id("blk"), type, props };

const column = (blocks) => ({ id: id("col"), blocks });

const section = (columns, options = {}) => ({
  id: id("sec"),
  layout: "1",
  columns,
  tone: options.tone ?? "default",
  padding: options.padding ?? "normal",
  divider: options.divider ?? "none",
  width: options.width ?? "measure",
  background: { key: "", overlay: 0.45 },
});

const main = [
  section([column([
    block("heading", { text: "M10.5, in a browser", level: "h1" }),
    block("text", { body: "Scroll: the Header should stay. Everything below is one of the four." }),
  ])]),

  // 1. A button row, two buttons side by side with different styles.
  section([column([
    block("heading", { text: "A button row", level: "h2" }),
    block("buttons", {
      align: "start",
      size: "medium",
      items: [
        { label: "Book a table", href: "/contact", style: "primary" },
        {
          label: "See the menu",
          href: "/menu",
          style: "outline",
          panelHeading: "Tonight's menu",
          panelBody: "Twelve courses, changing **weekly**. Snacks, bread, five plates.",
          image: { key: "", alt: "", width: null, height: null },
        },
      ],
    }),
    block("button", {
      label: "What a visit includes",
      href: "/",
      size: "large",
      panelHeading: "What a visit includes",
      panelBody: "A single **button** opening a panel, with no popovers Block anywhere near it.",
      panelImage: { key: "", alt: "", width: null, height: null },
    }),
  ])], { tone: "surface" }),

  // 2. Popovers, the team-page case from the exit criterion.
  section([column([
    block("heading", { text: "A team page's biographies", level: "h2" }),
    block("popovers", {
      title: "Our people",
      items: [
        {
          trigger: "Dr Amara Osei",
          heading: "Dr Amara Osei",
          body: "Twenty years in **tax**, and the person who signs off every return.\n\n- Chartered 2006\n- Leads the Bristol office",
          image: { key: "", alt: "", width: null, height: null },
        },
        {
          trigger: "Rowan Blake",
          heading: "Rowan Blake",
          body: "Audit and assurance. Joined from a Big Four practice in 2019.",
          image: { key: "", alt: "", width: null, height: null },
        },
      ],
    }),
  ])]),

  // 3. A full-width band -- the gallery running edge to edge.
  section([column([
    block("heading", { text: "Full width: this band has no side gutter", level: "h2" }),
    block("text", { body: "Compare the left edge of this text with the heading above it." }),
  ])], { tone: "primary", width: "full" }),

  // 4. And a wide band, between the two.
  section([column([
    block("heading", { text: "Wide: measure x 1.25", level: "h2" }),
    block("text", { body: "Wider than the bands above, still bounded." }),
  ])], { tone: "surface", width: "wide" }),

  // Something long, so there is enough page to scroll against a sticky Header.
  ...Array.from({ length: 6 }, (_, n) =>
    section([column([
      block("text", { body: `Filler band ${n + 1}, so the Page is tall enough to scroll.` }),
    ])], { tone: n % 2 ? "surface" : "default" })),
];

const [header] = await sql`select id from shared_slots where slot = 'header' limit 1`;
if (!header) throw new Error("no shared header to make sticky -- run pnpm seed first");

await sql`update shared_slots set sticky = 'sticky' where id = ${header.id}`;

const [footer] = await sql`select id from shared_slots where slot = 'footer' limit 1`;

const layout = { version: 1, slots: { header: [], main, sidebar: [], footer: [] } };

await sql`
  insert into pages (path, title, locale, draft_layout, published_layout, header_slot_id, footer_slot_id)
  values ('/m105', 'M10.5', 'en', ${sql.json(layout)}, ${sql.json(layout)},
          ${header.id}, ${footer?.id ?? null})
  on conflict (path, locale) do update
    set title = excluded.title,
        draft_layout = excluded.draft_layout,
        published_layout = excluded.published_layout,
        header_slot_id = excluded.header_slot_id,
        updated_at = now()
`;

console.log("wrote /m105 and set the main header to sticky");
await sql.end();
