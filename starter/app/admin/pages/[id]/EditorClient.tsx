"use client";

import { Editor, type MediaItem } from "@mimnets/admin";
import type { PageLayout, RenderContext, SlotName } from "@mimnets/core";

import { registry } from "../../../../blocks.config";
import type { PageVersionSummary } from "../../actions";

/**
 * The registry holds React components and Zod schemas, so it cannot be serialised across
 * the server/client boundary. Both sides import blocks.config directly instead: the server
 * to validate a save, the browser to render and edit.
 */
export function EditorClient({
  layout,
  pageTitle,
  versions,
  lockedSlots,
  signedInAs,
  context,
  onSave,
  onPublish,
  onRestore,
  onSignOut,
  onListMedia,
  onUploadMedia,
  mediaBaseUrl,
}: {
  layout: PageLayout;
  pageTitle: string;
  versions: PageVersionSummary[];
  lockedSlots: SlotName[];
  signedInAs: string;
  context: RenderContext;
  onSave: (layout: PageLayout) => Promise<void>;
  onPublish: (layout: PageLayout) => Promise<PageVersionSummary[]>;
  onRestore: (versionId: string) => Promise<PageLayout>;
  onSignOut: () => Promise<void>;
  onListMedia: () => Promise<MediaItem[]>;
  onUploadMedia: (form: FormData) => Promise<MediaItem>;
  mediaBaseUrl: string;
}) {
  return (
    <Editor
      layout={layout}
      registry={registry}
      pageTitle={pageTitle}
      versions={versions}
      lockedSlots={lockedSlots}
      signedInAs={signedInAs}
      context={context}
      onSave={onSave}
      onPublish={onPublish}
      onRestore={onRestore}
      onSignOut={onSignOut}
      media={{ list: onListMedia, upload: onUploadMedia, baseUrl: mediaBaseUrl }}
    />
  );
}
