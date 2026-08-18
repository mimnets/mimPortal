import type { ReactNode } from "react";

import "@mimnets/admin/editor.css";

export const metadata = {
  title: "Mimnets Dashboard",
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}
