import type { ReactNode } from "react";

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
