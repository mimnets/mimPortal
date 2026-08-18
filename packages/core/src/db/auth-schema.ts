import { boolean, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Tables Better Auth owns. The field names here are the ones the adapter looks for, taken
 * from the installed version rather than from memory — renaming a property breaks sign-in
 * with an error that points somewhere else entirely.
 *
 * `role` is ours: an Owner deploys the Site and can change its code and structure; an Author
 * changes content. Everything else in this file belongs to the library.
 */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: text("role", { enum: ["owner", "author"] })
    .notNull()
    .default("author"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One row per Site, holding what the Site knows about itself.
 *
 * `installedAt` is the installer's lock: once it is set, every route under /install refuses
 * to run. It lives in the database rather than on disk so that a redeploy or a fresh
 * container cannot resurrect the installer (ADR-0010).
 *
 * `lockedSlots` is where an Owner decides what an Author may not touch. Header and Footer
 * are locked by default, because that is where clients do the most damage.
 */
export const siteSettings = pgTable("site_settings", {
  id: text("id").primaryKey().default("singleton"),
  siteName: text("site_name").notNull().default("My Site"),
  lockedSlots: jsonb("locked_slots").$type<string[]>().notNull().default(["header", "footer"]),
  installToken: text("install_token"),
  installedAt: timestamp("installed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserRow = typeof user.$inferSelect;
export type Role = UserRow["role"];
export type SiteSettingsRow = typeof siteSettings.$inferSelect;
