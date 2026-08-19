import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * A Page: a single addressable screen of a Site, identified by its path.
 *
 * `draftLayout` and `publishedLayout` hold the whole Slot/Section/Column/Block tree as one
 * JSON document (ADR-0004). They are untyped `unknown` until M1 defines the layout schema —
 * every read must go through Zod parsing, never a cast.
 *
 * `locale` is deliberately unused for now (ADR-0005): it exists so adding a second language
 * later is a feature, not a migration of live client content.
 */
export const pages = pgTable(
  "pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    path: text("path").notNull(),
    title: text("title").notNull(),
    locale: text("locale").notNull().default("en"),
    draftLayout: jsonb("draft_layout").$type<unknown>(),
    publishedLayout: jsonb("published_layout").$type<unknown>(),
    // What search engines and a link preview show. All three are optional: an empty
    // seoTitle falls back to the Page title rather than publishing a blank <title>, which
    // is the failure mode of every CMS that stores these as required fields.
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    /** A storage key, not a URL, for the same reason the media table holds one. */
    seoImageKey: text("seo_image_key"),
    /**
     * Which shared Header and Footer this Page uses. Null means it keeps its own, stored in
     * its layout document — which is what every Page did before shared Slots existed, and
     * remains the escape hatch for a Page that genuinely needs a different one.
     */
    headerSlotId: uuid("header_slot_id"),
    footerSlotId: uuid("footer_slot_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("pages_path_locale_idx").on(table.path, table.locale)],
);

export type PageRow = typeof pages.$inferSelect;
export type NewPageRow = typeof pages.$inferInsert;

/**
 * An append-only record of what was published, written on every publish.
 *
 * History cannot be retrofitted — you cannot recover versions you never recorded — so it
 * exists from the milestone that introduces publishing rather than the one that needs it.
 * Restoring writes into the draft, never straight to the public Site: a restore is a
 * proposal an Author still has to publish.
 */
export const pageVersions = pgTable(
  "page_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    layout: jsonb("layout").$type<unknown>().notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("page_versions_page_idx").on(table.pageId, table.publishedAt)],
);

export type PageVersionRow = typeof pageVersions.$inferSelect;

/**
 * A Menu: a named list of links, edited in one place and rendered wherever it is used.
 *
 * Menus are their own entity rather than fields on a Header Block, because the same links
 * appear in the Header and the Footer and a client who edits one expects both to change.
 * That is the single most common complaint about template-built sites.
 */
export const menus = pgTable("menus", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  items: jsonb("items").$type<unknown>().notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type MenuRow = typeof menus.$inferSelect;

/**
 * An uploaded file, as the Dashboard knows it.
 *
 * The row holds a storage key, never a URL. Which bucket or directory that key resolves to
 * is the StorageAdapter’s business, so a Site can move from a disk to R2 without rewriting
 * every Page that used an image.
 *
 * `alt` is the description offered whenever the file is placed. The Block keeps its own
 * copy, because the same photograph is sometimes decorative and sometimes the point — but
 * an Author never starts from an empty box, which is how Sites end up with no alt text.
 */
export const media = pgTable(
  "media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull().unique(),
    filename: text("filename").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    // Null when the format hides its size behind a full decode (AVIF) or has none (SVG).
    width: integer("width"),
    height: integer("height"),
    alt: text("alt").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("media_created_idx").on(table.createdAt)],
);

export type MediaRow = typeof media.$inferSelect;
export type NewMediaRow = typeof media.$inferInsert;

/**
 * An enquiry from a Site's contact form.
 *
 * The row is written before the notification is attempted, and the submission is accepted
 * even when sending fails. A brochure Site exists to produce these; losing one because a
 * mail server was briefly unreachable is the worst outcome available, and the Dashboard is
 * the backstop that makes a lost email merely annoying.
 *
 * `senderHash` is a salted hash of the IP, not the address. Telling senders apart is enough
 * for a rate limit, and a table of addresses beside people's messages is a thing a client
 * would have to disclose.
 */
export const formSubmissions = pgTable(
  "form_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Which form, so one Site can have more than a contact page. */
    slug: text("slug").notNull(),
    /** The Page it was sent from, for context in the Dashboard. */
    path: text("path").notNull().default(""),
    name: text("name").notNull().default(""),
    email: text("email").notNull().default(""),
    message: text("message").notNull().default(""),
    senderHash: text("sender_hash").notNull().default(""),
    /** Null while unread; set when an Owner or Author opens it. */
    readAt: timestamp("read_at", { withTimezone: true }),
    /** Null when the notification sent, or the reason it did not. */
    deliveryError: text("delivery_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("form_submissions_created_idx").on(table.createdAt),
    // The rate limit counts recent submissions per sender, which is this index's whole job.
    index("form_submissions_sender_idx").on(table.senderHash, table.createdAt),
  ],
);

export type FormSubmissionRow = typeof formSubmissions.$inferSelect;

/**
 * A Header or Footer that many Pages share.
 *
 * Before this existed every Page carried its own copy, and the demo Site said "the Header
 * above is the same on every Page" while editing one changed exactly one Page. Only the
 * Menu inside it was shared, which made the claim half true and the behaviour surprising.
 *
 * The same reasoning as the Menu entity, one level up: the thing an Author expects when they
 * change a Header is that it changes everywhere, and a Site that does not do that generates
 * the single most common complaint about template-built sites.
 *
 * A Site can hold several — a full Header and a minimal one for landing Pages — and each
 * Page picks. `slot` says which region it may be used for, so a Footer cannot be selected
 * as a Header.
 */
export const sharedSlots = pgTable(
  "shared_slots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    /** "header" or "footer". Main and Sidebar are per-Page by definition. */
    slot: text("slot").notNull(),
    /** The Sections it holds, in the same shape a Page's Slot holds. */
    sections: jsonb("sections").$type<unknown>().notNull().default([]),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("shared_slots_slot_idx").on(table.slot)],
);

export type SharedSlotRow = typeof sharedSlots.$inferSelect;
