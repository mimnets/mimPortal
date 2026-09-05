import type { ReactNode } from "react";
import { Bricolage_Grotesque, IBM_Plex_Sans } from "next/font/google";
import { themeToCss } from "@mimnets/core";

import { theme } from "../theme";
import { activeTheme } from "../lib/theme";
// The standard Blocks bring their own structural CSS; this Site's stylesheet comes
// after it, so anything it says wins.
import "@mimnets/blocks/blocks.css";
import "./globals.css";

/**
 * The Site's two faces, self-hosted.
 *
 * `next/font` downloads these at build time and serves them from the Site's own origin, so a
 * visitor's browser never contacts Google. That matters beyond speed: a font fetched from a
 * third party is a third-party request, which is the beginning of a consent banner — the
 * same reasoning that keeps the map Block on OpenStreetMap.
 *
 * A Site that wants different faces changes them here and points `theme.ts` at the new
 * variables. A Site with no build-time network access should drop these and put a plain
 * font stack in `theme.ts` instead.
 */
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--mn-font-display",
  display: "swap",
});

const text = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--mn-font-text",
  display: "swap",
});

export const metadata = {
  title: "Mimnets Site",
  description: "A Site built with Mimnets",
};

// Read per request, because a Preset can change it while the Site is running.
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: ReactNode }) {
  const active = await activeTheme(theme);

  return (
    <html lang="en" className={`${display.variable} ${text.variable}`}>
      <head>
        {/* Theme tokens as custom properties. A <style> element rather than inline styles,
            so the values cascade into everything — including Blocks inside the Editor. */}
        <style dangerouslySetInnerHTML={{ __html: themeToCss(active) }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
