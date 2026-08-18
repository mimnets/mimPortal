import type { ReactNode } from "react";
import { themeToCss } from "@mimnets/core";

import { theme } from "../theme";
import "./globals.css";

export const metadata = {
  title: "Mimnets Site",
  description: "A Site built with Mimnets",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Theme tokens as custom properties. A <style> element rather than inline styles,
            so the values cascade into everything — including Blocks inside the Editor. */}
        <style dangerouslySetInnerHTML={{ __html: themeToCss(theme) }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
