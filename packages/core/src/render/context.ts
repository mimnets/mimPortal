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
  /**
   * Where uploaded files are served from. An image Block stores a storage key and builds
   * its URL from this, so moving a Site from its disk to a bucket with a CDN domain changes
   * one environment variable and no Page at all.
   */
  mediaBaseUrl: string;
  /**
   * A signed stamp of when this Page was rendered, embedded by any Block with a form.
   *
   * It is what the timing check measures against. Signed, because an unsigned timestamp in a
   * hidden field is a suggestion — anything that can read it can also set it.
   */
  formToken: string;
  /**
   * The request's query string. A form Block reads it to know whether to show "thank you",
   * which is how a result survives the redirect that follows a submission without needing
   * any JavaScript to have loaded.
   */
  query: Record<string, string>;
}

export function emptyContext(): RenderContext {
  return {
    siteName: "",
    menus: {},
    currentPath: "/",
    mediaBaseUrl: "/media",
    formToken: "",
    query: {},
  };
}
