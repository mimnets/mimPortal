import {
  index,
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
