import { jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

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
