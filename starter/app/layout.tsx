import type { ReactNode } from "react";

import "./globals.css";

export const metadata = {
  title: "Mimnets Site",
  description: "A Site built with Mimnets",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
