"use client";

import { Editor } from "@mimnets/admin";
import type { PageLayout } from "@mimnets/core";

import { registry } from "../../blocks.config";

/**
 * The registry holds React components and Zod schemas, so it cannot be serialised across
 * the server/client boundary. Both sides import blocks.config directly instead: the server
 * to validate a save, the browser to render and edit.
 */
export function EditorClient({
  layout,
  pageTitle,
  onSave,
}: {
  layout: PageLayout;
  pageTitle: string;
  onSave: (layout: PageLayout) => Promise<void>;
}) {
  return <Editor layout={layout} registry={registry} pageTitle={pageTitle} onSave={onSave} />;
}
