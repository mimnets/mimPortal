import { z } from "zod";

/**
 * A Menu item. One level deep on purpose: a nested navigation is a different design problem
 * — hover intent, keyboard traps, mobile behaviour — and it can be added without changing
 * anything else here.
 */
export const menuItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  href: z.string().min(1),
  newTab: z.boolean().default(false),
});

export const menuItemsSchema = z.array(menuItemSchema).default([]);

export type MenuItem = z.infer<typeof menuItemSchema>;

/**
 * What a Block can read beyond its own fields.
 *
 * A Menu Block holds the slug of a Menu, not a copy of its links — otherwise editing the
 * Menu would leave every Block that used it out of date. Blocks stay pure functions of
 * (props, context); the server resolves the context once per request.
 */
export interface RenderContext {
  siteName: string;
  menus: Record<string, MenuItem[]>;
  /** The path being rendered, so navigation can mark the current page. */
  currentPath: string;
}

export function emptyContext(): RenderContext {
  return { siteName: "", menus: {}, currentPath: "/" };
}
